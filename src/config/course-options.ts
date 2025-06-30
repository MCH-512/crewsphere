
export const courseCategoryGroups = {
  "Safety & Security": [
    "Safety Equipment",
    "Standard Operating Procedures (SOPs)",
    "Emergency Procedures",
    "Civil Aviation Security (AVSEC)",
    "Drills Briefing",
  ],
  "Dangerous Goods": ["Dangerous Goods (DG)"],
  "CRM & Human Factors": ["Crew Resource Management (CRM)", "Fatigue Risk Management System (FRMS)"],
  "First Aid": ["First Aid"],
  "Systems & Management": ["Safety Management System (SMS)", "Flight Time Limitations (FTL)"],
  "Aircraft Specific": ["Aircraft Type Rating"],
  "Service & Brand": [
    "Brand & Grooming",
    "Onboard Service",
    "Premium Service & Customer Relationship",
    "Etiquette and Personal Development",
  ],
  "Specialized Roles": [
    "Cabin Crew Instructor Training",
    "Cabin Senior (Purser) Training",
  ],
  "General Knowledge": ["General Information", "General Knowledge"],
};

// Main flattened list for validation and simple dropdowns
export const courseCategories = Object.values(courseCategoryGroups).flat();


export const courseTypes = [
  "Initial Training", 
  "Recurrent Training", 
  "Specialized Training", 
  "Commercial Training", 
  "Other Training"
];

export const questionTypes = ["mcq", "tf", "short"]; 

export const referenceBodyOptions = [
  "Operation Manual",
  "EASA",
  "IATA",
  "ICAO",
  "DGAC",
  "Note de service",
  "Other",
];

export const courseDurationOptions = [
  "15 minutes", "30 minutes", "45 minutes",
  "1 hour", "1 hour 30 minutes", "2 hours",
  "2 hours 30 minutes", "3 hours", "4 hours",
  "Half Day (4h)", "1 Day (8h)"
];
