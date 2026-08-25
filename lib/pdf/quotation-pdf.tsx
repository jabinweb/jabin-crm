import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #333',
    paddingBottom: 20,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.4,
  },
  quotationTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#7c3aed',
    textAlign: 'right',
    marginTop: -40,
  },
  quotationNumber: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
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
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 9,
    color: '#666',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 11,
    color: '#333',
    marginBottom: 6,
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#7c3aed',
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
    marginTop: 20,
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
    backgroundColor: '#7c3aed',
    color: '#fff',
    marginTop: 5,
  },
  validUntilBox: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#fef3c7',
    borderLeft: '3 solid #f59e0b',
  },
  validUntilText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: 'bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #e5e7eb',
    paddingTop: 15,
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
  statusAccepted: {
    backgroundColor: '#22c55e',
    color: '#fff',
  },
  statusRejected: {
    backgroundColor: '#ef4444',
    color: '#fff',
  },
  statusSent: {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
  statusDraft: {
    backgroundColor: '#6b7280',
    color: '#fff',
  },
});

interface QuotationData {
  quotationNumber: string;
  status: string;
  title: string;
  description?: string;
  createdAt: string;
  validUntil: string;
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
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  currency: string;
  terms?: string;
  notes?: string;
  companyName?: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyTaxId?: string;
  // Payment Details (optional for quotations)
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
    case 'ACCEPTED':
      return { ...baseStyle, ...styles.statusAccepted };
    case 'REJECTED':
      return { ...baseStyle, ...styles.statusRejected };
    case 'SENT':
    case 'VIEWED':
      return { ...baseStyle, ...styles.statusSent };
    default:
      return { ...baseStyle, ...styles.statusDraft };
  }
};

const formatCurrency = (amount: number, currency: string) => {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
    JPY: '¥',
  };
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toFixed(2)}`;
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const QuotationPDF: React.FC<{ quotation: QuotationData }> = ({ quotation }) => {
  const primaryColor = quotation.primaryColor || '#7c3aed';
  const footerMessage = quotation.footerText || 'We look forward to working with you!';
  
  return (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.row}>
          <View>
            {quotation.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image
              <Image
                src={quotation.logoUrl}
                style={{ width: 120, height: 48, objectFit: 'contain', marginBottom: 8 }}
              />
            ) : null}
            <Text style={{ ...styles.companyName, color: primaryColor }}>
              {quotation.companyName || 'Your Company Name'}
            </Text>
            {quotation.headerText ? (
              <Text style={{ ...styles.companyDetails, marginBottom: 6 }}>
                {quotation.headerText}
              </Text>
            ) : null}
            {quotation.companyAddress && (
              <Text style={styles.companyDetails}>{quotation.companyAddress}</Text>
            )}
            {quotation.companyEmail && (
              <Text style={styles.companyDetails}>{quotation.companyEmail}</Text>
            )}
            {quotation.companyPhone && (
              <Text style={styles.companyDetails}>{quotation.companyPhone}</Text>
            )}
            {quotation.companyTaxId && (
              <Text style={styles.companyDetails}>Tax ID: {quotation.companyTaxId}</Text>
            )}
          </View>
          <View>
            <Text style={{ ...styles.quotationTitle, color: primaryColor }}>QUOTATION</Text>
            <Text style={styles.quotationNumber}>{quotation.quotationNumber}</Text>
            <View style={getStatusStyle(quotation.status)}>
              <Text>{quotation.status}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Title & Description */}
      {quotation.title && (
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 }}>
            {quotation.title}
          </Text>
          {quotation.description && (
            <Text style={{ fontSize: 10, color: '#666' }}>{quotation.description}</Text>
          )}
        </View>
      )}

      {/* Customer & Quotation Info */}
      <View style={styles.row}>
        <View style={styles.customerBox}>
          <Text style={styles.sectionTitle}>Prepared For</Text>
          <Text style={styles.value}>{quotation.customerName}</Text>
          {quotation.customerEmail && (
            <Text style={styles.value}>{quotation.customerEmail}</Text>
          )}
          {quotation.customerPhone && (
            <Text style={styles.value}>{quotation.customerPhone}</Text>
          )}
          {quotation.customerAddress && (
            <Text style={styles.value}>{quotation.customerAddress}</Text>
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.sectionTitle}>Quotation Details</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={styles.label}>Date:</Text>
            <Text style={styles.value}>{formatDate(quotation.createdAt)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
            <Text style={styles.label}>Valid Until:</Text>
            <Text style={styles.value}>{formatDate(quotation.validUntil)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.label}>Currency:</Text>
            <Text style={styles.value}>{quotation.currency}</Text>
          </View>
        </View>
      </View>

      {/* Valid Until Warning */}
      <View style={styles.validUntilBox}>
        <Text style={styles.validUntilText}>
          ⚠ This quotation is valid until {formatDate(quotation.validUntil)}
        </Text>
      </View>

      {/* Items Table */}
      <View style={styles.table}>
        <View style={{ ...styles.tableHeader, backgroundColor: primaryColor }}>
          <Text style={styles.col1}>Description</Text>
          <Text style={styles.col2}>Qty</Text>
          <Text style={styles.col3}>Unit Price</Text>
          <Text style={styles.col4}>Amount</Text>
        </View>

        {quotation.items.map((item, index) => (
          <View key={index} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <View style={styles.col1}>
              <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{item.name}</Text>
              {item.description && (
                <Text style={{ fontSize: 8, color: '#666' }}>{item.description}</Text>
              )}
            </View>
            <Text style={styles.col2}>{item.quantity}</Text>
            <Text style={styles.col3}>{formatCurrency(item.unitPrice, quotation.currency)}</Text>
            <Text style={styles.col4}>{formatCurrency(item.amount, quotation.currency)}</Text>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text>Subtotal:</Text>
          <Text>{formatCurrency(quotation.subtotal, quotation.currency)}</Text>
        </View>

        {quotation.discount > 0 && (
          <View style={styles.totalRow}>
            <Text>Discount:</Text>
            <Text>-{formatCurrency(quotation.discount, quotation.currency)}</Text>
          </View>
        )}

        {quotation.taxRate > 0 && (
          <View style={styles.totalRow}>
            <Text>Tax ({quotation.taxRate}%):</Text>
            <Text>{formatCurrency(quotation.taxAmount, quotation.currency)}</Text>
          </View>
        )}

        <View style={{ ...styles.totalRowFinal, backgroundColor: primaryColor }}>
          <Text>TOTAL:</Text>
          <Text>{formatCurrency(quotation.total, quotation.currency)}</Text>
        </View>
      </View>

      {/* Terms & Notes */}
      {(quotation.terms || quotation.notes) && (
        <View style={styles.section}>
          {quotation.terms && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.sectionTitle}>Terms & Conditions</Text>
              <Text style={{ fontSize: 9, color: '#666' }}>{quotation.terms}</Text>
            </View>
          )}
          {quotation.notes && (
            <View>
              <Text style={styles.sectionTitle}>Additional Notes</Text>
              <Text style={{ fontSize: 9, color: '#666' }}>{quotation.notes}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {footerMessage}
        </Text>
        {!quotation.footerText && (
          <Text style={styles.footerText}>
            Please contact us if you have any questions about this quotation.
          </Text>
        )}
      </View>
    </Page>
  </Document>
  );
};
