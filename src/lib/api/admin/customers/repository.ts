import type {
  CreateCustomerInput,
  CustomerDataSource,
  CustomerDetailResult,
  CustomerListQuery,
  CustomerListResult,
  CustomerMutationResult,
  UpdateCustomerInput,
} from "./types";

export interface CustomersRepository {
  readonly source: CustomerDataSource;
  list(query?: CustomerListQuery): Promise<CustomerListResult>;
  getById(id: string): Promise<CustomerDetailResult>;
  create(input: CreateCustomerInput): Promise<CustomerMutationResult>;
  update(id: string, input: UpdateCustomerInput): Promise<CustomerMutationResult>;
  updateNotes(id: string, notes: string): Promise<CustomerMutationResult>;
  anonymize(id: string): Promise<CustomerMutationResult>;
  exportCsv(query?: CustomerListQuery): Promise<string>;
  exportCustomerDetailCsv(id: string): Promise<string>;
  isEmailAvailable(email: string, excludeCustomerId?: string): Promise<boolean>;
}
