// Canonical category list used for manual classification across the app.
// `key` is the raw value stored on the transaction; `pt` is the label shown.
// Sorted A–Z by PT label, with "Outros" (catch-all) always last.
export const CATEGORIES = [
  { key: 'Food and Groceries',        pt: 'Alimentação'           },
  { key: 'Subscriptions and Services',pt: 'Assinaturas'           },
  { key: 'Automotive',                pt: 'Automóvel'             },
  { key: 'Home',                      pt: 'Casa'                  },
  { key: 'Fuel',                      pt: 'Combustível'           },
  { key: 'Shopping',                  pt: 'Compras'               },
  { key: 'Utilities',                 pt: 'Contas de Consumo'     },
  { key: 'Personal Care',             pt: 'Cuidados Pessoais'     },
  { key: 'Food Delivery',             pt: 'Delivery'              },
  { key: 'Education',                 pt: 'Educação'              },
  { key: 'Entertainment',             pt: 'Entretenimento'        },
  { key: 'Investments',               pt: 'Investimentos'         },
  { key: 'Credit Card Payment',       pt: 'Pagamento de Fatura'   },
  { key: 'Transfer - PIX',            pt: 'PIX'                   },
  { key: 'Restaurants',               pt: 'Restaurantes'          },
  { key: 'Salary',                    pt: 'Salário'               },
  { key: 'Health',                    pt: 'Saúde'                 },
  { key: 'Services',                  pt: 'Serviços'              },
  { key: 'Supermarkets',              pt: 'Supermercados'         },
  { key: 'Bank Fees',                 pt: 'Tarifas Bancárias'     },
  { key: 'Telecom',                   pt: 'Telefonia'             },
  { key: 'Transfers',                 pt: 'Transferências'        },
  { key: 'Transport',                 pt: 'Transporte'            },
  { key: 'Travel',                    pt: 'Viagens'               },
  { key: 'Others',                    pt: 'Outros'                },
]

// Alphabetical (pt-BR) comparator for category objects ({ pt }).
// Keeps the "Outros" catch-all pinned last regardless of the rest.
export const compareCategories = (a, b) => {
  if (a.pt === 'Outros') return 1
  if (b.pt === 'Outros') return -1
  return a.pt.localeCompare(b.pt, 'pt', { sensitivity: 'base' })
}

// A transaction still counts as "unclassified" when it carries no category or
// only the generic catch-all. Used to surface what needs manual attention.
export function needsClassification(cat) {
  return !cat || cat === 'Others' || cat === 'Other' || cat === 'Outros'
}

// Fallback only — some banks (e.g. Nubank) spell the installment in the text.
const INSTALLMENT_TEXT_RE = /\b\d+\s*\/\s*\d+\b|PARC\b|PARCELA\b/i

// A transaction is an installment ("parcelado") when the ETL captured the
// structured fields from creditCardMetadata — the reliable signal across banks,
// notably Santander, whose description carries no "3/10". The description regex
// is only a fallback. Always prefer the fields, never parse the description alone.
export function isInstallment(t) {
  return Boolean(t?.installment_number && t?.installment_total) ||
    INSTALLMENT_TEXT_RE.test(t?.description ?? '')
}

// Normalized merchant fingerprint derived from a transaction description.
// Strips common prefixes (PG*, PAG*), symbols, and noise (dates, city codes).
// Ensures "UBER *TRIP 12/05" and "UBER TRIP" result in the same key "uber trip".
export function merchantKey(description) {
  if (!description) return ''
  
  let d = description.toLowerCase()
    // Remove common prefixes
    .replace(/^(pg\s*\*|pag\s*\*|p\s*\*|compra\s+|pagto\s+|pgto\s+|venda\s+|transf\s+|pix\s+enviado\s+|pix\s+recebido\s+)/g, '')
    // Noise at the end (dates, UF)
    .replace(/(\s+\d{2}\/\d{2}|\s+\d{4}|\s+[a-z]{2})$/g, '')
    // Replace symbols with spaces to avoid merging words
    .replace(/[\*\-\/#@]/g, ' ')
  
  const words = d.trim().split(/\s+/)
  
  const noise = ['sao', 'pau', 'sp', 'rj', 'mg', 'bh', 'osasco', 'curitiba', 'brasilia', 'br']
  const meaningful = []
  
  for (const w of words) {
    const cleanW = w.replace(/[^a-z0-9]/g, '')
    if (cleanW.length >= 3 && !/^\d+$/.test(cleanW) && !noise.includes(cleanW)) {
      meaningful.push(cleanW)
      if (meaningful.length >= 2) break
    }
  }
  
  // Fallback: sanitized first 25 characters
  if (meaningful.length === 0) {
    return d.replace(/[^a-z0-9\s]/g, '').trim().slice(0, 25).trim()
  }
  
  return meaningful.join(' ')
}
