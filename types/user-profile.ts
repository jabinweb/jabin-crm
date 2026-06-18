export interface UserProfileFormData {
  companyName: string;
  industry: string;
  companySize: string;
  website: string;
  description: string;
  service: string;
  targetAudience: string;
  valueProposition: string;
  geminiApiKey: string;
  googlePlacesApiKey: string;
  aiModel: string;
  preferredCurrency: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  taxId: string;
  invoicePrefix: string;
  quotationPrefix: string;
  invoiceTerms: string;
  quotationTerms: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  iban: string;
  paymentInstructions: string;
  templateStyle: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  headerText: string;
  footerText: string;
}

export const DEFAULT_USER_PROFILE_FORM: UserProfileFormData = {
  companyName: '',
  industry: '',
  companySize: '',
  website: '',
  description: '',
  service: '',
  targetAudience: '',
  valueProposition: '',
  geminiApiKey: '',
  googlePlacesApiKey: '',
  aiModel: 'gemini-2.0-flash',
  preferredCurrency: 'USD',
  companyAddress: '',
  companyEmail: '',
  companyPhone: '',
  taxId: '',
  invoicePrefix: 'INV',
  quotationPrefix: 'QT',
  invoiceTerms: 'Payment is due within 30 days',
  quotationTerms: 'This quotation is valid for 30 days from the date of issue',
  bankName: '',
  accountName: '',
  accountNumber: '',
  routingNumber: '',
  swiftCode: '',
  iban: '',
  paymentInstructions: '',
  templateStyle: 'modern',
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  logoUrl: '',
  headerText: '',
  footerText: '',
};
