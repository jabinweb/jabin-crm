import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Register fonts with better Unicode support
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf',
});

// Use Courier New which has good Unicode support
Font.register({
  family: 'Courier New',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/courierprime/v8/u-450q2lgwslOqpF_6gQ8kELawFpWg.woff2',
      fontWeight: 400,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '2 solid #333',
    paddingBottom: 15,
  },
  logoSpace: {
    width: 120,
    height: 60,
    marginBottom: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.4,
  },
  invoiceHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563eb',
    letterSpacing: 2,
    marginBottom: 8,
  },
  invoiceNumber: {
    fontSize: 11,
    color: '#666',
    marginTop: 3,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  customerBox: {
    width: '48%',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  infoBox: {
    width: '48%',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  label: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 10,
    color: '#333',
    marginBottom: 4,
    lineHeight: 1.5,
  },
  table: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    padding: 10,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #e5e7eb',
    padding: 10,
    fontSize: 10,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottom: '1 solid #e5e7eb',
    padding: 10,
    fontSize: 10,
  },
  col1: { width: '40%' },
  col2: { width: '20%', textAlign: 'center' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '20%', textAlign: 'right' },
  totalsSection: {
    marginTop: 10,
    marginLeft: 'auto',
    width: '45%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    fontSize: 11,
  },
  totalRowFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    fontSize: 13,
    fontWeight: 'bold',
    backgroundColor: '#2563eb',
    color: '#fff',
    marginTop: 5,
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: '1 solid #e5e7eb',
  },
  footerText: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    marginBottom: 3,
  },
  statusBadge: {
    padding: '5 10',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    alignSelf: 'flex-start',
  },
  statusPaid: {
    backgroundColor: '#22c55e',
    color: '#fff',
  },
  statusOverdue: {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
  statusPartial: {
    backgroundColor: '#f59e0b',
    color: '#fff',
  },
  statusDraft: {
    backgroundColor: '#6b7280',
    color: '#fff',
  },
});

interface InvoiceData {
  invoiceNumber: string;
  status: string;
  createdAt: string;
  dueDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    hsnSac?: string;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  terms?: string;
  notes?: string;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyTaxId?: string;
  gstin?: string;
  placeOfSupply?: string;
  taxBreakup?: { cgst?: number; sgst?: number; igst?: number } | null;
  // Payment Details
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  paymentInstructions?: string;
  // Template Customization
  templateStyle?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
}

const getStatusStyle = (status: string) => {
  const baseStyle = styles.statusBadge;
  switch (status) {
    case 'PAID':
      return { ...baseStyle, ...styles.statusPaid };
    case 'OVERDUE':
      return { ...baseStyle, ...styles.statusOverdue };
    case 'PARTIAL':
      return { ...baseStyle, ...styles.statusPartial };
    default:
      return { ...baseStyle, ...styles.statusDraft };
  }
};

const formatCurrency = (amount: number, currency: string) => {
  const currencyFormatters: Record<string, (amt: number) => string> = {
    USD: (amt) => `$${amt.toFixed(2)}`,
    EUR: (amt) => `€${amt.toFixed(2)}`,
    GBP: (amt) => `£${amt.toFixed(2)}`,
    INR: (amt) => `Rs. ${amt.toFixed(2)}`,
    AUD: (amt) => `A$${amt.toFixed(2)}`,
    CAD: (amt) => `C$${amt.toFixed(2)}`,
    JPY: (amt) => `¥${amt.toFixed(0)}`,
    CNY: (amt) => `¥${amt.toFixed(2)}`,
    CHF: (amt) => `CHF ${amt.toFixed(2)}`,
    SEK: (amt) => `${amt.toFixed(2)} kr`,
    NZD: (amt) => `NZ$${amt.toFixed(2)}`,
  };
  const formatter = currencyFormatters[currency.toUpperCase()];
  return formatter ? formatter(amount) : `${currency} ${amount.toFixed(2)}`;
};

// Function to clean up corrupted currency symbols in text
const cleanCurrencySymbols = (text: string) => {
  if (!text) return text;
  // Replace corrupted Rupee symbols with Rs.
  return text.replace(/¹/g, 'Rs. ');
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const InvoicePDF: React.FC<{ invoice: InvoiceData }> = ({ invoice }) => {
  const primaryColor = invoice.primaryColor || '#2563eb';
  const footerMessage = invoice.footerText || 'Thank you for your business!';
  
  return (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.row}>
          <View>
            <Text style={styles.companyName}>
              {invoice.companyName || 'Your Company Name'}
            </Text>
            {invoice.companyAddress && (
              <Text style={styles.companyDetails}>{invoice.companyAddress}</Text>
            )}
            {invoice.companyEmail && (
              <Text style={styles.companyDetails}>{invoice.companyEmail}</Text>
            )}
            {invoice.companyPhone && (
              <Text style={styles.companyDetails}>{invoice.companyPhone}</Text>
            )}
            {invoice.companyTaxId && (
              <Text style={styles.companyDetails}>Tax ID: {invoice.companyTaxId}</Text>
            )}
            {invoice.gstin && (
              <Text style={styles.companyDetails}>GSTIN: {invoice.gstin}</Text>
            )}
          </View>
          <View style={styles.invoiceHeader}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
        </View>
      </View>

      {/* Customer & Invoice Info */}
      <View style={styles.row}>
        <View style={styles.customerBox}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.value}>{invoice.customerName}</Text>
          {invoice.customerEmail && (
            <Text style={styles.value}>{invoice.customerEmail}</Text>
          )}
          {invoice.customerPhone && (
            <Text style={styles.value}>{invoice.customerPhone}</Text>
          )}
          {invoice.customerAddress && (
            <Text style={styles.value}>{invoice.customerAddress}</Text>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={styles.label}>Issue Date:</Text>
            <Text style={styles.value}>{formatDate(invoice.createdAt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={styles.label}>Due Date:</Text>
            <Text style={styles.value}>{formatDate(invoice.dueDate)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.label}>Currency:</Text>
            <Text style={styles.value}>{invoice.currency}</Text>
          </View>
          {invoice.placeOfSupply ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
              <Text style={styles.label}>Place of supply:</Text>
              <Text style={styles.value}>{invoice.placeOfSupply}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Items Table */}
      <View style={styles.table}>
        <View style={{ ...styles.tableHeader, backgroundColor: primaryColor }}>
          <Text style={styles.col1}>Description</Text>
          <Text style={styles.col2}>Qty</Text>
          <Text style={styles.col3}>Unit Price</Text>
          <Text style={styles.col4}>Amount</Text>
        </View>

        {invoice.items.map((item, index) => (
          <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <View style={styles.col1}>
              <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{item.name}</Text>
              {item.hsnSac ? (
                <Text style={{ fontSize: 8, color: '#666' }}>HSN/SAC: {item.hsnSac}</Text>
              ) : null}
              {item.description && (
                <Text style={{ fontSize: 8, color: '#666' }}>{item.description}</Text>
              )}
            </View>
            <Text style={styles.col2}>{item.quantity}</Text>
            <Text style={styles.col3}>{formatCurrency(item.unitPrice, invoice.currency)}</Text>
            <Text style={styles.col4}>{formatCurrency(item.amount, invoice.currency)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text>Subtotal:</Text>
          <Text>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
        </View>

        {invoice.discount > 0 && (
          <View style={styles.totalRow}>
            <Text>Discount:</Text>
            <Text>-{formatCurrency(invoice.discount, invoice.currency)}</Text>
          </View>
        )}

        {invoice.taxRate > 0 && (
          <View style={styles.totalRow}>
            <Text>Tax ({invoice.taxRate.toFixed(2)}%):</Text>
            <Text>{formatCurrency(invoice.taxAmount, invoice.currency)}</Text>
          </View>
        )}
        {invoice.taxBreakup?.cgst ? (
          <View style={styles.totalRow}>
            <Text>CGST:</Text>
            <Text>{formatCurrency(invoice.taxBreakup.cgst, invoice.currency)}</Text>
          </View>
        ) : null}
        {invoice.taxBreakup?.sgst ? (
          <View style={styles.totalRow}>
            <Text>SGST:</Text>
            <Text>{formatCurrency(invoice.taxBreakup.sgst, invoice.currency)}</Text>
          </View>
        ) : null}
        {invoice.taxBreakup?.igst ? (
          <View style={styles.totalRow}>
            <Text>IGST:</Text>
            <Text>{formatCurrency(invoice.taxBreakup.igst, invoice.currency)}</Text>
          </View>
        ) : null}

        <View style={{ ...styles.totalRowFinal, backgroundColor: primaryColor }}>
          <Text>TOTAL:</Text>
          <Text>{formatCurrency(invoice.total, invoice.currency)}</Text>
        </View>

        {invoice.amountPaid > 0 && (
          <>
            <View style={styles.totalRow}>
              <Text>Amount Paid:</Text>
              <Text style={{ color: '#22c55e' }}>
                -{formatCurrency(invoice.amountPaid, invoice.currency)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={{ fontWeight: 'bold' }}>Amount Due:</Text>
              <Text style={{ fontWeight: 'bold', color: '#ef4444' }}>
                {formatCurrency(invoice.amountDue, invoice.currency)}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Terms, Notes & Payment Information - Wrap together */}
      {((invoice.terms || invoice.notes) || (invoice.bankName || invoice.accountNumber || invoice.paymentInstructions)) && (
        <View style={{ marginBottom: 15, marginTop: 10 }}>
          {(invoice.terms || invoice.notes) && (
            <View style={{ marginBottom: 10 }}>
              {invoice.terms && (
                <View style={{ marginBottom: 6 }}>
                  <Text style={styles.sectionTitle}>Payment Terms</Text>
                  <Text style={{ fontSize: 9, color: '#666', lineHeight: 1.4 }}>{cleanCurrencySymbols(invoice.terms)}</Text>
                </View>
              )}
              {invoice.notes && (
                <View>
                  <Text style={styles.sectionTitle}>Notes</Text>
                  <Text style={{ fontSize: 9, color: '#666', lineHeight: 1.4 }}>{cleanCurrencySymbols(invoice.notes)}</Text>
                </View>
              )}
            </View>
          )}

      {/* Payment Information */}
      {(invoice.bankName || invoice.accountNumber || invoice.paymentInstructions) && (
        <View>
          <Text style={styles.sectionTitle}>Payment Information</Text>
          <View style={{ 
            padding: 12, 
            backgroundColor: '#f0f9ff', 
            borderRadius: 4,
            borderLeft: `3 solid ${invoice.primaryColor || '#2563eb'}` 
          }}>
            {invoice.bankName && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: '#666' }}>Bank Name: </Text>
                <Text style={{ fontSize: 10, color: '#333', fontWeight: 'bold' }}>{invoice.bankName}</Text>
              </View>
            )}
            {invoice.accountName && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: '#666' }}>Account Name: </Text>
                <Text style={{ fontSize: 10, color: '#333' }}>{invoice.accountName}</Text>
              </View>
            )}
            {invoice.accountNumber && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: '#666' }}>Account Number: </Text>
                <Text style={{ fontSize: 10, color: '#333' }}>{invoice.accountNumber}</Text>
              </View>
            )}
            {invoice.routingNumber && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: '#666' }}>Routing Number: </Text>
                <Text style={{ fontSize: 10, color: '#333' }}>{invoice.routingNumber}</Text>
              </View>
            )}
            {invoice.swiftCode && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: '#666' }}>SWIFT/BIC: </Text>
                <Text style={{ fontSize: 10, color: '#333' }}>{invoice.swiftCode}</Text>
              </View>
            )}
            {invoice.iban && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 9, color: '#666' }}>IBAN: </Text>
                <Text style={{ fontSize: 10, color: '#333' }}>{invoice.iban}</Text>
              </View>
            )}
            {invoice.paymentInstructions && (
              <View style={{ marginTop: 8, paddingTop: 8, borderTop: '1 solid #cbd5e1' }}>
                <Text style={{ fontSize: 9, color: '#666', lineHeight: 1.4 }}>
                  {invoice.paymentInstructions}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {footerMessage}
        </Text>
        {!invoice.footerText && (
          <Text style={styles.footerText}>
            This is a computer-generated invoice and does not require a signature.
          </Text>
        )}
      </View>
    </Page>
  </Document>
  );
};
