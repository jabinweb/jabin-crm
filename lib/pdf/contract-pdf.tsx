import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 36,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 24,
    borderBottom: '2 solid #333',
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.4,
  },
  docTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f766e',
    textAlign: 'right',
  },
  docNumber: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  box: {
    width: '48%',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  label: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 10,
    color: '#333',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metaLabel: { width: 120, fontSize: 9, color: '#666' },
  metaValue: { flex: 1, fontSize: 10, color: '#333' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#999',
    borderTop: '1 solid #eee',
    paddingTop: 8,
  },
});

export type ContractPdfData = {
  title: string;
  type: string;
  status: string;
  contractNumber?: string | null;
  startDate: string;
  endDate: string;
  annualValue?: number | null;
  currency: string;
  includesParts: boolean;
  visitLimit?: number | null;
  visitsUsed?: number;
  notes?: string | null;
  customerName: string;
  customerCity?: string | null;
  equipmentName?: string | null;
  equipmentSerial?: string | null;
  companyName: string;
  companyAddress?: string;
  companyEmail?: string;
  companyPhone?: string;
};

function formatMoney(amount: number, currency: string) {
  if (currency === 'INR') return `Rs. ${amount.toFixed(2)}`;
  return `${currency} ${amount.toFixed(2)}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ContractPDF({ contract }: { contract: ContractPdfData }) {
  const remaining =
    contract.visitLimit != null
      ? Math.max(0, contract.visitLimit - (contract.visitsUsed ?? 0))
      : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{contract.companyName}</Text>
            {contract.companyAddress ? (
              <Text style={styles.companyDetails}>{contract.companyAddress}</Text>
            ) : null}
            {contract.companyEmail ? (
              <Text style={styles.companyDetails}>{contract.companyEmail}</Text>
            ) : null}
            {contract.companyPhone ? (
              <Text style={styles.companyDetails}>{contract.companyPhone}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.docTitle}>{contract.type} CONTRACT</Text>
            {contract.contractNumber ? (
              <Text style={styles.docNumber}>#{contract.contractNumber}</Text>
            ) : null}
            <Text style={styles.docNumber}>Status: {contract.status}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Text style={styles.value}>{contract.customerName}</Text>
            {contract.customerCity ? (
              <Text style={styles.value}>{contract.customerCity}</Text>
            ) : null}
          </View>
          <View style={styles.box}>
            <Text style={styles.sectionTitle}>Coverage</Text>
            <Text style={styles.value}>{contract.title}</Text>
            {contract.equipmentName ? (
              <Text style={styles.value}>
                Equipment: {contract.equipmentName}
                {contract.equipmentSerial ? ` (${contract.equipmentSerial})` : ''}
              </Text>
            ) : (
              <Text style={styles.value}>All units / account-level</Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Term & value</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Start</Text>
            <Text style={styles.metaValue}>{formatDate(contract.startDate)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>End</Text>
            <Text style={styles.metaValue}>{formatDate(contract.endDate)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Annual value</Text>
            <Text style={styles.metaValue}>
              {contract.annualValue != null
                ? formatMoney(contract.annualValue, contract.currency)
                : '—'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Parts included</Text>
            <Text style={styles.metaValue}>{contract.includesParts ? 'Yes' : 'No'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit utilisation</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Visit limit</Text>
            <Text style={styles.metaValue}>
              {contract.visitLimit != null ? String(contract.visitLimit) : 'Unlimited'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Visits used</Text>
            <Text style={styles.metaValue}>{String(contract.visitsUsed ?? 0)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Remaining</Text>
            <Text style={styles.metaValue}>
              {remaining != null ? String(remaining) : '—'}
            </Text>
          </View>
        </View>

        {contract.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.value}>{contract.notes}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Generated by Opslane · {formatDate(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  );
}
