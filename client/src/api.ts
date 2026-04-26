const BASE = (import.meta.env.VITE_API_BASE ?? "") as string;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const bodyPreview = (await res.text()).slice(0, 200);
    throw new Error(
      `Expected JSON response but got "${contentType || "unknown"}" from ${url}. Body starts with: ${bodyPreview}`
    );
  }

  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Company {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  customerCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Package {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  features: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Promotion {
  id: number;
  name: string;
  description: string | null;
  discountPercent: number | null;
  discountAmount: number | null;
  validFrom: string;
  validUntil: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: "active" | "inactive" | "churned";
  notes: string | null;
  companyId: number | null;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
  // Current active package (from JOIN)
  cpId: number | null;
  packageId: number | null;
  packageName: string | null;
  joinedAt: string | null;
  expiresAt: string | null;
  cpStatus: string | null;
  pricePaid: number | null;
  promotionId: number | null;
  promotionName: string | null;
}

export interface CustomerPackage {
  id: number;
  customerId: number;
  customerName: string;
  customerEmail: string;
  packageId: number;
  packageName: string;
  promotionId: number | null;
  promotionName: string | null;
  joinedAt: string;
  expiresAt: string;
  pricePaid: number | null;
  status: "active" | "expired" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  totalCompanies: number;
  activePackagesCount: number;
  activeSubscriptions: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  expiredSubscriptions: number;
  totalRevenue: number;
  newCustomers30d: number;
}

export interface PackageAssignment {
  packageId: number;
  promotionId?: number | null;
  joinedAt?: string;
  expiresAt: string;
  pricePaid?: number | null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  // Stats
  stats: () => req<DashboardStats>("/api/stats"),

  // Companies
  listCompanies: () => req<Company[]>("/api/companies"),
  createCompany: (b: Omit<Company, "id" | "customerCount" | "createdAt" | "updatedAt">) =>
    req<Company>("/api/companies", { method: "POST", body: JSON.stringify(b) }),
  updateCompany: (id: number, b: Partial<Omit<Company, "id" | "customerCount" | "createdAt" | "updatedAt">>) =>
    req<Company>(`/api/companies/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteCompany: (id: number) =>
    req<void>(`/api/companies/${id}`, { method: "DELETE" }),

  // Packages
  listPackages: () => req<Package[]>("/api/packages"),
  createPackage: (b: Omit<Package, "id" | "createdAt" | "updatedAt">) =>
    req<Package>("/api/packages", { method: "POST", body: JSON.stringify(b) }),
  updatePackage: (id: number, b: Partial<Omit<Package, "id" | "createdAt" | "updatedAt">>) =>
    req<Package>(`/api/packages/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deletePackage: (id: number) =>
    req<void>(`/api/packages/${id}`, { method: "DELETE" }),

  // Promotions
  listPromotions: () => req<Promotion[]>("/api/promotions"),
  createPromotion: (b: Omit<Promotion, "id" | "createdAt" | "updatedAt">) =>
    req<Promotion>("/api/promotions", { method: "POST", body: JSON.stringify(b) }),
  updatePromotion: (id: number, b: Partial<Omit<Promotion, "id" | "createdAt" | "updatedAt">>) =>
    req<Promotion>(`/api/promotions/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deletePromotion: (id: number) =>
    req<void>(`/api/promotions/${id}`, { method: "DELETE" }),

  // Customers
  listCustomers: (params?: { search?: string; status?: string; companyId?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search)    qs.set("search", params.search);
    if (params?.status)    qs.set("status", params.status);
    if (params?.companyId) qs.set("companyId", String(params.companyId));
    return req<Customer[]>(`/api/customers?${qs}`);
  },
  createCustomer: (b: {
    firstName: string; lastName: string; email: string;
    phone?: string | null; companyId?: number | null;
    status?: string; notes?: string | null;
    packageAssignment?: PackageAssignment | null;
  }) => req<Customer>("/api/customers", { method: "POST", body: JSON.stringify(b) }),
  updateCustomer: (id: number, b: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt">>) =>
    req<Customer>(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteCustomer: (id: number) =>
    req<void>(`/api/customers/${id}`, { method: "DELETE" }),

  // Customer Packages
  listCustomerPackages: (params?: { customerId?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.customerId) qs.set("customerId", String(params.customerId));
    if (params?.status)     qs.set("status", params.status);
    return req<CustomerPackage[]>(`/api/customer-packages?${qs}`);
  },
  expiringPackages: (days = 7) =>
    req<CustomerPackage[]>(`/api/customer-packages/expiring?days=${days}`),
  assignPackage: (b: PackageAssignment & { customerId: number }) =>
    req<CustomerPackage>("/api/customer-packages", { method: "POST", body: JSON.stringify(b) }),
  updateCustomerPackage: (id: number, b: Partial<CustomerPackage>) =>
    req<CustomerPackage>(`/api/customer-packages/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteCustomerPackage: (id: number) =>
    req<void>(`/api/customer-packages/${id}`, { method: "DELETE" }),
};
