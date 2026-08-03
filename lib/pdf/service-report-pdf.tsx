import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 36,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#111827',
  },
  subtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 20,
  },
  section: {
    marginBottom: 14,
  },
  label: {
    fontSize: 9,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  body: {
    fontSize: 11,
    color: '#111827',
    lineHeight: 1.45,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  col: {
    flex: 1,
  },
  box: {
    border: '1 solid #e5e7eb',
    padding: 10,
    borderRadius: 4,
  },
  signature: {
    width: 220,
    height: 70,
    marginTop: 6,
  },
});

export type ServiceReportPdfData = {
  reportId: string;
  ticketSubject: string;
  ticketId: string;
  customerName: string;
  technicianName: string;
  serviceNotes: string;
  partsReplaced?: string;
  nextMaintenanceDate?: string;
  createdAt: string;
  customerSignerName?: string;
  signedAt?: string;
  signatureDataUrl?: string;
  equipmentLabel?: string;
};

export function ServiceReportPDF(data: ServiceReportPdfData) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Service Report</Text>
        <Text style={styles.subtitle}>
          {data.ticketSubject} · #{data.ticketId.slice(-8).toUpperCase()} ·{' '}
          {new Date(data.createdAt).toLocaleString()}
        </Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.body}>{data.customerName}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Technician</Text>
            <Text style={styles.body}>{data.technicianName}</Text>
          </View>
        </View>

        {data.equipmentLabel ? (
          <View style={styles.section}>
            <Text style={styles.label}>Equipment</Text>
            <Text style={styles.body}>{data.equipmentLabel}</Text>
          </View>
        ) : null}

        <View style={[styles.section, styles.box]}>
          <Text style={styles.label}>Work performed</Text>
          <Text style={styles.body}>{data.serviceNotes}</Text>
        </View>

        {data.partsReplaced ? (
          <View style={styles.section}>
            <Text style={styles.label}>Parts used</Text>
            <Text style={styles.body}>{data.partsReplaced}</Text>
          </View>
        ) : null}

        {data.nextMaintenanceDate ? (
          <View style={styles.section}>
            <Text style={styles.label}>Next maintenance</Text>
            <Text style={styles.body}>
              {new Date(data.nextMaintenanceDate).toLocaleDateString()}
            </Text>
          </View>
        ) : null}

        <View style={[styles.section, styles.box]}>
          <Text style={styles.label}>Customer sign-off</Text>
          {data.customerSignerName ? (
            <Text style={styles.body}>{data.customerSignerName}</Text>
          ) : (
            <Text style={styles.body}>Not signed</Text>
          )}
          {data.signedAt ? (
            <Text style={[styles.body, { fontSize: 9, color: '#6b7280', marginTop: 4 }]}>
              Signed {new Date(data.signedAt).toLocaleString()}
            </Text>
          ) : null}
          {data.signatureDataUrl ? (
            <Image src={data.signatureDataUrl} style={styles.signature} />
          ) : null}
        </View>

        <Text style={[styles.subtitle, { marginTop: 24 }]}>
          Report ID: {data.reportId}
        </Text>
      </Page>
    </Document>
  );
}
