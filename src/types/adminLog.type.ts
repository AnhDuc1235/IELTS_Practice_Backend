export type adminLogQuery = {
    page: number;
    limit: number;
    search?: string | undefined;
    action?: string | undefined;
    sort?: string | undefined;
}