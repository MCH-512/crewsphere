
export const courseCategoryGroups = {
  "Safety & Emergency": [
    "Safety & Emergency Procedures (SEP)",
    "Security (AVSEC)",
    "Dangerous Goods (DG)",
    "First Aid",
  ],
  "Human Factors": [
    "Crew Resource Management (CRM)",
    "Fatigue Risk Management (FRMS)",
  ],
  "Operational Knowledge": [
    "Standard Operating Procedures (SOPs)",
    "Flight Time Limitations (FTL)",
    "Aircraft Type Rating",
    "Safety Management System (SMS)",
  ],
  "Service & Professionalism": [
    "Onboard Service Standards",
    "Brand & Grooming",
    "Commercial & Premium Services",
  ],
  "Career Development": [
    "Instructor & Purser Training",
    "General Knowledge & Updates",
  ]
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
