export type ProductService = "planning" | "activity" | "feedback" | "telemetry";
export declare const PRODUCT_SERVICES: readonly ProductService[];
export declare function serviceForApiPath(pathname: string): ProductService | "noxhere" | null;
