import { z } from 'zod';

export const DecodeWeatherReportInputSchema = z.object({
  reportCode: z.string().describe('The raw METAR or TAF string to be decoded.'),
});
export type DecodeWeatherReportInput = z.infer<typeof DecodeWeatherReportInputSchema>;

export const DecodeWeatherReportOutputSchema = z.object({
  reportType: z.enum(["METAR", "TAF", "Unknown"]).describe("The type of the report."),
  station: z.string().describe("The ICAO code of the reporting station (e.g., KJFK)."),
  time: z.string().describe("The time of the report in Zulu format (e.g., 1551Z)."),
  wind: z.object({
    direction: z.string().describe("Wind direction in degrees or 'Variable'."),
    speed: z.string().describe("Wind speed in knots."),
    gusts: z.string().optional().describe("Wind gusts in knots, if present."),
  }),
  visibility: z.string().describe("Visibility in statute miles (SM) or meters (m)."),
  weather: z.string().describe("Significant weather phenomena (e.g., '-RA' for Light Rain, 'BR' for Mist). If none, state 'No significant weather'."),
  clouds: z.array(z.string()).describe("Cloud layers, including coverage and altitude in feet (e.g., 'FEW018' for Few at 1,800 feet)."),
  temperature: z.string().describe("Temperature in Celsius."),
  dewPoint: z.string().describe("Dew point in Celsius."),
  pressure: z.string().describe("Altimeter setting in inches of mercury (inHg) or hectopascals (hPa)."),
  summary: z.string().describe("A concise, human-readable summary of the weather conditions described in the report."),
});
export type DecodeWeatherReportOutput = z.infer<typeof DecodeWeatherReportOutputSchema>;
