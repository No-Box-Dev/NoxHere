export type ProductService = "noxticket" | "noxfeed" | "noxspot" | "noxcue";
export declare const PRODUCT_SERVICES: readonly ProductService[];
export declare function serviceForApiPath(pathname: string): ProductService | "noxconnect" | null;
