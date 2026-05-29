"""
FinDash ETL — MCP.AI Open Finance → Firebase Cloud Function
Busca dados bancários (contas, transações, faturas, investimentos)
via proxy MCP.AI e envia ao webhook do Firebase.
"""

from __future__ import annotations

import os
import re
import sys
import uuid
import logging
from datetime import datetime, timedelta, date
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("etl_pluggy.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("etl_pluggy")

MCP_INSTALL_ID   = os.environ["MCP_INSTALL_ID"]
MCP_API_KEY      = os.environ["MCP_API_KEY"]
MCP_BASE         = f"https://api.mcp.ai/api/playground/{MCP_INSTALL_ID}/call-installed"

PLUGGY_ITEM_IDS  = [i.strip() for i in os.environ["PLUGGY_ITEM_IDS"].split(",") if i.strip()]

FIREBASE_WEBHOOK_URL = os.environ.get("FIREBASE_WEBHOOK_URL")
FIREBASE_ETL_SECRET  = os.environ.get("FIREBASE_ETL_SECRET")
FIREBASE_USER_UID    = os.environ.get("FIREBASE_USER_UID")

DAYS_BACK = int(os.environ.get("DAYS_BACK", "90"))
MAX_TX    = int(os.environ.get("MAX_TX", "500"))


class MCPClient:
    def __init__(self) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {MCP_API_KEY}",
            "Content-Type": "application/json",
        })
        log.info("MCP client inicializado")

    def _call(self, tool_id: str, args: dict | None = None) -> dict:
        resp = self.session.post(
            MCP_BASE,
            json={"tool_id": tool_id, "args": args or {}},
            timeout=30,
        )
        resp.raise_for_status()
        result = resp.json()
        if not result.get("ok"):
            raise RuntimeError(f"MCP error [{tool_id}]: {result.get('error')}")
        return result["result"]

    def get_bank_name(self, item_id: str) -> str:
        try:
            r = self._call("openfinance_get_item_status", {"item": item_id})
            return (r.get("connector") or {}).get("name") or r.get("connector_name") or f"Banco_{item_id[:8]}"
        except Exception:
            return f"Banco_{item_id[:8]}"

    @staticmethod
    def _extract_list(r: Any, *keys: str) -> list:
        """Extrai lista de resposta MCP independente da estrutura retornada."""
        if isinstance(r, list):
            return r
        for k in keys:
            v = r.get(k)
            if isinstance(v, list):
                return v
        return []

    def get_accounts(self, item_id: str) -> list[dict]:
        r = self._call("openfinance_list_accounts", {"item": item_id})
        return self._extract_list(r, "results", "accounts")

    def get_transactions(self, account_id: str, from_date: str, to_date: str) -> list[dict]:
        all_txs: list[dict] = []
        page = 1
        while True:
            r = self._call("openfinance_list_transactions", {
                "account_id": account_id,
                "from": from_date,
                "to": to_date,
                "page": page,
                "page_size": 500,
            })
            txs = self._extract_list(r, "results", "transactions")
            all_txs.extend(txs)
            total_pages = r.get("totalPages", 1) if isinstance(r, dict) else 1
            if page >= total_pages or not txs:
                break
            page += 1
        return all_txs

    def get_bills(self, account_id: str) -> list[dict]:
        try:
            r = self._call("openfinance_list_credit_card_bills", {
                "account_id": account_id,
                "page_size": 100,
            })
            return self._extract_list(r, "results", "bills")
        except Exception as e:
            log.warning(f"get_bills falhou para conta {account_id[:8]}: {e}")
            return []

    def get_investments(self, item_id: str) -> list[dict]:
        """Busca investimentos com paginação, tentando dois nomes de parâmetro."""
        all_inv: list[dict] = []
        for param_key in ("item_id", "item"):
            try:
                page = 1
                while True:
                    r = self._call("openfinance_list_investments", {
                        param_key: item_id,
                        "page": page,
                        "page_size": 100,
                    })
                    batch = self._extract_list(r, "results", "investments")
                    all_inv.extend(batch)
                    total_pages = r.get("totalPages", 1) if isinstance(r, dict) else 1
                    if page >= total_pages or not batch:
                        break
                    page += 1
                if all_inv:
                    log.info(f"  get_investments OK via param '{param_key}': {len(all_inv)} itens")
                    return all_inv
            except Exception as e:
                log.warning(f"  get_investments '{param_key}' falhou para {item_id[:8]}: {e}")
        log.warning(f"  get_investments: nenhum dado obtido para item {item_id[:8]}")
        return []

    def get_investment_transactions(self, investment_id: str) -> list[dict]:
        try:
            r = self._call("openfinance_list_investment_transactions", {"investment_id": investment_id})
            return self._extract_list(r, "transactions", "results")
        except Exception as e:
            log.warning(f"get_investment_transactions falhou: {e}")
            return []


def _f(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (ValueError, TypeError):
        return 0.0


def _normalize_account_type(raw: str) -> str:
    """Normaliza tipos da Pluggy para CREDIT | INVESTMENT | SAVINGS | BANK."""
    t = raw.upper()
    if "CREDIT" in t:
        return "CREDIT"
    if "INVEST" in t:
        return "INVESTMENT"
    if "SAVING" in t or "POUPANCA" in t or "POUPANÇA" in t:
        return "SAVINGS"
    return "BANK"


def normalize_account(acc: dict, bank_name: str) -> dict:
    cd = acc.get("creditData") or {}
    raw_type = acc.get("type", "BANK")
    return {
        "account_id":      acc.get("id"),
        "bank_name":       bank_name,
        "bank_connector":  acc.get("bankData", {}).get("transferNumber", "") if isinstance(acc.get("bankData"), dict) else "",
        "account_type":    _normalize_account_type(raw_type),
        "name":            acc.get("name", ""),
        "balance":         _f(acc.get("balance")),
        "limit":           _f(cd.get("creditLimit")) or None,
        "available_limit": _f(cd.get("availableCreditLimit")) or None,
        "status":          "ACTIVE",
        "currency":        acc.get("currencyCode", "BRL"),
    }


def normalize_transaction(tx: dict, bank_name: str, account_id: str) -> dict:
    amount = float(tx.get("amount", 0) or 0)
    tx_type = tx.get("type", "")
    if tx_type == "DEBIT":
        amount = -abs(amount)
    elif tx_type == "CREDIT":
        amount = abs(amount)

    # Pluggy retorna metadados de parcelamento em creditCardMetadata
    cc_meta = tx.get("creditCardMetadata") or {}
    installment_number = cc_meta.get("installmentNumber") or cc_meta.get("number")
    installment_total  = cc_meta.get("totalInstallments") or cc_meta.get("total")
    bill_id            = cc_meta.get("billId") or cc_meta.get("creditCardBillId")

    return {
        "transaction_id":      tx.get("id"),
        "bank":                bank_name,
        "account_id":          account_id,
        "date":                (tx.get("date") or "")[:10],
        "description":         tx.get("description", ""),
        "amount":              amount,
        "category":            tx.get("category", "Outros"),
        "balance":             tx.get("balance"),
        "currency":            tx.get("currencyCode", "BRL"),
        "type":                tx_type,
        "status":              tx.get("status", "POSTED"),
        "installment_number":  installment_number,
        "installment_total":   installment_total,
        "bill_id":             bill_id,
    }


_INSTALLMENT_RE = re.compile(r'\b\d+\s*/\s*\d+\b|PARC\b|PARCELA\b|PARCELAMENTO\b', re.IGNORECASE)


def _item_is_installment(item: dict) -> bool:
    if item.get("installments"):
        return True
    return bool(_INSTALLMENT_RE.search(item.get("description", "")))


def _item_description(item: dict) -> str:
    """A Pluggy às vezes coloca a descrição direto, às vezes em attributes."""
    return (
        item.get("description")
        or (item.get("attributes") or {}).get("description")
        or (item.get("attributes") or {}).get("name")
        or item.get("name")
        or ""
    )


def normalize_bill(bill: dict, bank_name: str, account_id: str) -> dict:
    raw_items = bill.get("finance") or bill.get("items") or []
    return {
        "bill_id":    bill.get("id"),
        "bank":       bank_name,
        "account_id": account_id,
        "due_date":   (bill.get("dueDate") or "")[:10],
        "close_date": (bill.get("closeDate") or "")[:10] or None,
        "total":      _f(bill.get("totalAmount")),
        "minimum":    _f(bill.get("minimumPaymentAmount") or bill.get("minimumPayment")) or None,
        "status":     bill.get("payment_status") or bill.get("paymentStatus", "OPEN"),
        "items":      [
            {
                "description":    _item_description(i),
                "amount":         _f(i.get("amount")),
                "type":           i.get("type", ""),
                "date":           (i.get("date") or "")[:10] or None,
                "is_installment": _item_is_installment(i),
            }
            for i in raw_items
        ],
    }


_SUBTYPE_TO_TYPE = {
    "REAL_ESTATE_FUND": "FII",
    "CDB":              "CDB",
    "LCI":              "LCI",
    "LCA":              "LCA",
    "TREASURY":         "TESOURO",
    "TESOURO_DIRETO":   "TESOURO",
    "DEBENTURE":        "RENDA_FIXA",
    "CRI":              "RENDA_FIXA",
    "CRA":              "RENDA_FIXA",
}


def account_as_investment(acc: dict, bank_name: str) -> dict | None:
    """Converte conta INVESTMENT/SAVINGS em registro de investimento como fallback."""
    balance = _f(acc.get("balance"))
    if balance <= 0:
        return None
    raw_type = acc.get("type", "BANK").upper()
    inv_type = "TESOURO" if "SAVING" in raw_type or "POUPANCA" in raw_type else "OUTROS"
    return {
        "investment_id": f"acc_{acc.get('id', '')}",
        "bank":          bank_name,
        "ticker":        acc.get("name", ""),
        "name":          acc.get("name", ""),
        "type":          inv_type,
        "subtype":       raw_type,
        "quantity":      None,
        "value":         balance,
        "balance":       balance,
        "status":        "ACTIVE",
        "annual_rate":   None,
        "due_date":      None,
    }


def normalize_investment(inv: dict, bank_name: str) -> dict:
    raw_type    = (inv.get("investmentType") or inv.get("type") or "OUTROS").upper()
    raw_subtype = (inv.get("subtype") or "").upper()
    final_type  = _SUBTYPE_TO_TYPE.get(raw_subtype, raw_type)

    return {
        "investment_id": inv.get("id"),
        "bank":          bank_name,
        "ticker":        inv.get("code") or inv.get("name", ""),
        "name":          inv.get("name", ""),
        "type":          final_type,
        "subtype":       raw_subtype or None,
        "quantity":      inv.get("quantity"),
        "value":         _f(inv.get("value")) or None,
        "balance":       _f(inv.get("balance")),
        "status":        (inv.get("status") or "ACTIVE").upper(),
        "annual_rate":   inv.get("annualRate"),
        "due_date":      (inv.get("dueDate") or "")[:10] or None,
    }


def post_to_firebase(
    bank: str,
    accounts: list[dict],
    transactions: list[dict],
    bills: list[dict],
    investments: list[dict],
    run_id: str,
) -> None:
    if not FIREBASE_WEBHOOK_URL:
        log.warning("FIREBASE_WEBHOOK_URL não configurado — pulando sync Firebase.")
        return

    payload = {
        "uid":          FIREBASE_USER_UID,
        "run_id":       run_id,
        "bank":         bank,
        "accounts":     accounts,
        "transactions": transactions[-MAX_TX:],
        "bills":        bills,
        "investments":  investments,
    }
    try:
        resp = requests.post(
            FIREBASE_WEBHOOK_URL,
            json=payload,
            headers={"X-ETL-Secret": FIREBASE_ETL_SECRET or ""},
            timeout=60,
        )
        resp.raise_for_status()
        log.info(f"Firebase webhook OK — status {resp.status_code} — run_id={run_id}")
    except requests.RequestException as exc:
        log.error(f"Firebase webhook FALHOU: {exc}")
        raise


def run_etl() -> None:
    client    = MCPClient()
    from_date = (date.today() - timedelta(days=DAYS_BACK)).isoformat()
    to_date   = date.today().isoformat()

    for item_id in PLUGGY_ITEM_IDS:
        run_id = str(uuid.uuid4())
        try:
            bank_name = client.get_bank_name(item_id)
            log.info(f"Processando item {item_id} — {bank_name}")

            raw_accounts = client.get_accounts(item_id)
            accounts     = [normalize_account(a, bank_name) for a in raw_accounts]
            log.info(f"  Contas: {len(accounts)}")

            all_transactions:  list[dict] = []
            all_bills:         list[dict] = []
            investment_accs:   list[dict] = []   # fallback accounts

            for raw_acc in raw_accounts:
                acc_id    = raw_acc["id"]
                raw_type  = raw_acc.get("type", "BANK")
                acc_type  = _normalize_account_type(raw_type)
                acc_name  = raw_acc.get("name", "")
                log.info(f"    [{raw_type}→{acc_type}] {acc_name!r} ({acc_id[:8]})")

                if acc_type in ("INVESTMENT", "SAVINGS"):
                    investment_accs.append(raw_acc)
                    log.info(f"      → conta de investimento detectada (balance={raw_acc.get('balance')})")
                    continue   # não busca transações dessas contas

                raw_txs = client.get_transactions(acc_id, from_date, to_date)
                all_transactions.extend(normalize_transaction(t, bank_name, acc_id) for t in raw_txs)
                log.info(f"      Transações: {len(raw_txs)}")

                if acc_type == "CREDIT":
                    raw_bills = client.get_bills(acc_id)
                    all_bills.extend(normalize_bill(b, bank_name, acc_id) for b in raw_bills)
                    log.info(f"      Faturas: {len(raw_bills)}")

            # Investimentos via endpoint dedicado
            raw_investments = client.get_investments(item_id)
            investments     = [normalize_investment(i, bank_name) for i in raw_investments]
            log.info(f"  Investimentos via API: {len(investments)}")

            # Fallback: contas INVESTMENT/SAVINGS não cobertas pelo endpoint
            if investment_accs:
                fallback_ids = {i["investment_id"] for i in investments}
                for raw_acc in investment_accs:
                    synth = account_as_investment(raw_acc, bank_name)
                    if synth and synth["investment_id"] not in fallback_ids:
                        investments.append(synth)
                        log.info(f"  Fallback investimento: {synth['name']!r} = R$ {synth['balance']:.2f}")

            log.info(f"  Investimentos total: {len(investments)}")

            log.info(
                f"  Total — contas={len(accounts)} tx={len(all_transactions)} "
                f"faturas={len(all_bills)} inv={len(investments)}"
            )

            post_to_firebase(
                bank=bank_name,
                accounts=accounts,
                transactions=all_transactions,
                bills=all_bills,
                investments=investments,
                run_id=run_id,
            )

        except Exception as exc:
            log.error(f"Erro ao processar item {item_id}: {exc}", exc_info=True)
            try:
                requests.post(
                    FIREBASE_WEBHOOK_URL or "",
                    json={"uid": FIREBASE_USER_UID, "run_id": run_id, "status": "error", "error": str(exc)},
                    headers={"X-ETL-Secret": FIREBASE_ETL_SECRET or ""},
                    timeout=10,
                )
            except Exception:
                pass


if __name__ == "__main__":
    log.info("=" * 60)
    log.info("FinDash ETL iniciado")
    log.info(f"Janela: últimos {DAYS_BACK} dias | Items: {PLUGGY_ITEM_IDS}")
    log.info("=" * 60)
    run_etl()
    log.info("FinDash ETL concluído")
