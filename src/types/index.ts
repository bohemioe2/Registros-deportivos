export interface EventType {
  id: string;
  name: string;
  description: string;
  paymentMethods: string;
  liabilityText: string;
  categoriesEnabled: boolean;
  welcomeTemplateUrl?: string;
  createdAt: number;
}

export interface CategoryType {
  id: string;
  eventId: string;
  name: string;
  gender: 'MALE' | 'FEMALE' | 'MIXED';
  minAge: number;
  maxAge: number;
}

export interface RegistrationType {
  id: string; // Folio
  eventId: string;
  categoryId?: string; // If categories enabled
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  
  // Personal info
  firstName: string;
  lastName: string;
  age: number;
  gender: 'MALE' | 'FEMALE';
  bloodType: string;
  state: string;
  municipality: string;
  phone1: string;
  phone2: string;
  
  // Media files (Firebase Storage object URLs)
  paymentProofUrl: string;
  profilePhotoUrl: string;
  teamLogoUrl?: string;
  officialIdUrl: string;
  signatureUrl: string; // Required from legal responsibility
  
  createdAt: number;
}
