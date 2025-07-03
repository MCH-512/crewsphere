
import { z } from "zod";
import type { Timestamp } from 'firebase/firestore';
import { Shield, HeartPulse, Utensils, AlertCircle, UserCheck, Wrench, MessageSquare, PlusCircle, ClipboardEdit, ClipboardList } from "lucide-react";

export const optionalReportSections = [
    { name: 'briefingDetails', label: 'Briefing & Questions', placeholder: 'Décrivez le déroulement du briefing, les points abordés, les questions posées par l\'équipage et les réponses apportées...', icon: ClipboardEdit },
    { name: 'crewTaskDistribution', label: 'Répartition des Tâches', placeholder: 'Détaillez la répartition des tâches et des zones de responsabilité entre les membres de l\'équipage...', icon: ClipboardList },
    { name: 'cateringDetails', label: 'Service & Prestations', placeholder: 'Notez le nombre et le type de prestations, les problèmes de stock, les retours sur la qualité, la gestion des repas spéciaux...', icon: Utensils },
    { name: 'safetyIncidents', label: 'Incidents de Sécurité (Safety)', placeholder: 'Décrivez tout incident ou préoccupation lié à la sécurité (safety)...', icon: Shield },
    { name: 'securityIncidents', label: 'Incidents de Sûreté (Security)', placeholder: 'Décrivez tout incident ou préoccupation lié à la sûreté (security)...', icon: AlertCircle },
    { name: 'medicalIncidents', label: 'Incidents Médicaux', placeholder: 'Décrivez tout incident médical, les soins administrés ou les demandes d\'assistance médicale...', icon: HeartPulse },
    { name: 'passengerFeedback', label: 'Retours Passagers Importants', placeholder: 'Notez tout retour passager, positif ou négatif, qui mérite d\'être signalé...', icon: MessageSquare },
    { name: 'maintenanceIssues', label: 'Problèmes de Maintenance ou d\'Équipement', placeholder: 'Décrivez tout problème technique ou dysfonctionnement d\'équipement en cabine...', icon: Wrench },
    { name: 'crewPerformanceNotes', label: 'Notes sur la Performance de l\'Équipage', placeholder: 'Notez toute performance exceptionnelle ou point d\'amélioration au sein de l\'équipage...', icon: UserCheck },
    { name: 'otherObservations', label: 'Autres Observations', placeholder: 'Toute autre note ou observation pertinente pour le vol...', icon: PlusCircle },
] as const;


const passengerLoadSchema = z.object({
  total: z.number().min(0, "Total must be 0 or more.").default(0),
  adults: z.number().min(0, "Adults must be 0 or more.").default(0),
  infants: z.number().min(0, "Infants must be 0 or more.").default(0),
}).refine(data => data.adults + data.infants <= data.total, {
  message: "Sum of adults and infants cannot exceed the total number of passengers.",
  path: ["total"],
});


export const purserReportFormSchema = z.object({
  // Pre-filled, hidden fields for reference
  flightId: z.string(),
  flightNumber: z.string(),
  flightDate: z.string(), // ISO string
  departureAirport: z.string(),
  arrivalAirport: z.string(),
  aircraftTypeRegistration: z.string(),
  
  // User-filled fields
  passengerLoad: passengerLoadSchema,
  crewMembers: z.string().min(10, "Please list the crew members on duty (min 10 characters)."),
  generalFlightSummary: z.string().min(20, "Please provide a summary of at least 20 characters."),

  // Optional sections
  briefingDetails: z.string().optional(),
  crewTaskDistribution: z.string().optional(),
  cateringDetails: z.string().optional(),
  safetyIncidents: z.string().optional(),
  securityIncidents: z.string().optional(),
  medicalIncidents: z.string().optional(),
  passengerFeedback: z.string().optional(),
  maintenanceIssues: z.string().optional(),
  crewPerformanceNotes: z.string().optional(),
  otherObservations: z.string().optional(),
});


export type PurserReportFormValues = z.infer<typeof purserReportFormSchema>;

export interface StoredPurserReport extends PurserReportFormValues {
  id: string;
  userId: string;
  userEmail: string;
  createdAt: Timestamp;
  status: 'submitted' | 'under-review' | 'closed';
  adminNotes?: string;
}
