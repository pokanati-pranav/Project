export type Envelope<T> = { success: boolean; message: string; data: T; timestamp: string };
export type User = { id: number; name: string; email: string; role: string; organizationId: number };
export type Reading = { id: number; buildingId: number; buildingName: string; readingDate: string; energyConsumedKwh: number; source: string };
export type Building = { id: number; organizationId: number; name: string; type: string; location: string; areaSqft: number; floors: number };
export type Point = { date: string; kwh: number };
export type Dashboard = { totalEnergyKwh: number; totalEmissionsKg: number; emissionFactorConfigured: boolean; buildingCount: number; readingDays: number; activeAlerts: number; recommendationCount: number; trend: Point[] };
