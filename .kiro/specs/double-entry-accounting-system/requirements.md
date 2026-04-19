# Requirements Document

## Introduction

Sistem ini akan mengubah mekanisme pencatatan transaksi dari single-entry menjadi double-entry accounting system. Perubahan fundamental ini memastikan setiap transaksi terhubung ke akun (account) dan mengikuti prinsip akuntansi double-entry yang benar: setiap transaksi mempengaruhi minimal dua akun dengan jumlah yang seimbang.

Sistem double-entry ini akan meningkatkan akurasi pencatatan keuangan, memungkinkan tracking saldo per akun secara real-time, dan mendukung fitur kartu kredit dengan pencatatan liability yang tepat.

## Glossary

- **Transaction_System**: Sistem pencatatan transaksi keuangan yang mengelola expense, income, dan transfer
- **Account**: Entitas penyimpanan nilai keuangan (contoh: BCA, Cash, Mandiri, Kartu Kredit BNI)
- **Account_Type**: Klasifikasi akun berdasarkan jenis (asset atau liability)
- **AI_Classifier**: Komponen yang mengekstrak informasi transaksi dari input natural language user
- **Schema_Validator**: Komponen yang memvalidasi struktur data sebelum disimpan ke database
- **Manual_Form**: Form input transaksi manual yang diisi user melalui UI
- **Ledger_System**: Sistem perhitungan saldo berbasis ledger entries
- **Sheets_Integration**: Integrasi dengan Google Sheets untuk backup data transaksi
- **Double_Entry**: Prinsip akuntansi dimana setiap transaksi mempengaruhi minimal dua akun dengan jumlah seimbang

## Requirements

### Requirement 1: Mandatory Account Association

**User Story:** As a user, I want every transaction to be linked to an account, so that I can track my money flow accurately across different accounts.

#### Acceptance Criteria

1. THE Schema_Validator SHALL reject any transaction creation attempt without a valid accountId
2. WHEN a transaction is submitted via Manual_Form, THE Transaction_System SHALL require accountId selection before allowing submission
3. WHEN a transaction is submitted via AI input, THE AI_Classifier SHALL extract account name from user input
4. IF account name is not mentioned in AI input, THEN THE Transaction_System SHALL return a clarification request listing available accounts
5. THE Transaction_System SHALL validate that accountId references an active account before saving

### Requirement 2: AI Account Name Extraction

**User Story:** As a user, I want to mention my account name in natural language input, so that the system automatically links my transaction to the correct account.

#### Acceptance Criteria

1. WHEN user input contains an account name, THE AI_Classifier SHALL extract the account name to accountName field
2. THE AI_Classifier SHALL match extracted accountName against user's available accounts using case-insensitive partial matching
3. IF extracted accountName matches exactly one account, THE Transaction_System SHALL use that account's ID
4. IF extracted accountName matches multiple accounts, THE Transaction_System SHALL return clarification listing matched accounts
5. IF extracted accountName matches no accounts, THE Transaction_System SHALL return clarification listing all available accounts

### Requirement 3: Account Selection Clarification

**User Story:** As a user, I want clear guidance when I forget to mention an account, so that I can quickly correct my input.

#### Acceptance Criteria

1. WHEN a transaction has no accountId and user has zero accounts, THE Transaction_System SHALL return clarification "Belum ada akun. Buat akun dulu di menu Akun sebelum input transaksi."
2. WHEN an expense transaction has no accountId and user has accounts, THE Transaction_System SHALL return clarification "Transaksi dari akun mana? Pilih salah satu: [account list]. Contoh: '[original input] pakai [first account name]'"
3. WHEN an income transaction has no accountId and user has accounts, THE Transaction_System SHALL return clarification "Transaksi masuk ke akun mana? Pilih salah satu: [account list]. Contoh: '[original input] pakai [first account name]'"
4. THE Transaction_System SHALL include all active account names in the clarification message
5. THE Transaction_System SHALL provide an example using the user's first account name

### Requirement 4: Schema Migration for Required AccountId

**User Story:** As a developer, I want the database schema to enforce accountId requirement, so that data integrity is maintained at the database level.

#### Acceptance Criteria

1. THE Schema_Validator SHALL define Transaction.accountId as a required field (non-nullable)
2. WHEN migrating existing data, THE Transaction_System SHALL handle existing transactions with null accountId
3. THE Schema_Validator SHALL maintain foreign key constraint between Transaction.accountId and Account.id
4. THE Schema_Validator SHALL use onDelete: SetNull behavior for account deletion to preserve transaction history
5. THE Transaction_System SHALL create database indexes on userId and accountId for query performance

### Requirement 5: Manual Form Account Validation

**User Story:** As a user, I want the manual transaction form to prevent submission without selecting an account, so that I don't create invalid transactions.

#### Acceptance Criteria

1. THE Manual_Form SHALL display account selection dropdown as a required field
2. THE Manual_Form SHALL disable submit button when no account is selected
3. WHEN user has zero active accounts, THE Manual_Form SHALL display a message "Belum ada akun. Buat akun dulu untuk mulai input manual."
4. THE Manual_Form SHALL group accounts by AccountType in the dropdown for better organization
5. THE Manual_Form SHALL show account name and type in the dropdown options

### Requirement 6: AI Prompt Enhancement for Account Extraction

**User Story:** As a developer, I want the AI system prompt to include account extraction instructions, so that the AI can reliably extract account information from user input.

#### Acceptance Criteria

1. THE AI_Classifier SHALL include account extraction rules in the system prompt
2. THE AI_Classifier SHALL receive the list of user's available accounts as context
3. WHEN user mentions "pakai [account name]", "dari [account name]", or "ke [account name]", THE AI_Classifier SHALL extract the account name
4. THE AI_Classifier SHALL recognize common account name patterns (bank names, "cash", "dompet", "kartu kredit")
5. THE AI_Classifier SHALL leave accountName undefined when no account is mentioned in user input

### Requirement 7: Expense Transaction Account Handling

**User Story:** As a user, I want my expense transactions to correctly deduct from the specified account, so that my account balance reflects actual spending.

#### Acceptance Criteria

1. WHEN an expense transaction is created, THE Transaction_System SHALL record it with type "expense" and the specified accountId
2. THE Ledger_System SHALL calculate account balance by subtracting expense amounts from the account
3. THE Transaction_System SHALL validate that accountId belongs to the authenticated user
4. WHEN accountId is invalid or inactive, THE Transaction_System SHALL return error "Akun tidak valid atau tidak aktif"
5. THE Transaction_System SHALL preserve the existing ledger-based balance calculation logic

### Requirement 8: Income Transaction Account Handling

**User Story:** As a user, I want my income transactions to correctly add to the specified account, so that my account balance reflects actual income received.

#### Acceptance Criteria

1. WHEN an income transaction is created, THE Transaction_System SHALL record it with type "income" and the specified accountId
2. THE Ledger_System SHALL calculate account balance by adding income amounts to the account
3. THE Transaction_System SHALL validate that accountId belongs to the authenticated user
4. WHEN accountId is invalid or inactive, THE Transaction_System SHALL return error "Akun tidak valid atau tidak aktif"
5. THE Transaction_System SHALL preserve the existing ledger-based balance calculation logic

### Requirement 9: Transfer Transaction Account Handling

**User Story:** As a user, I want transfer transactions to correctly move money between my accounts, so that both source and destination account balances are accurate.

#### Acceptance Criteria

1. WHEN a transfer is created, THE Transaction_System SHALL create two linked transactions with a shared transferId
2. THE Transaction_System SHALL create a transfer_out transaction with the source accountId
3. THE Transaction_System SHALL create a transfer_in transaction with the destination accountId
4. THE Ledger_System SHALL subtract the amount from source account balance
5. THE Ledger_System SHALL add the amount to destination account balance

### Requirement 10: Credit Card Expense Handling

**User Story:** As a user, I want credit card expenses to increase my credit card liability, so that I can track how much I owe on my credit card.

#### Acceptance Criteria

1. WHEN an expense transaction uses a credit card account (AccountType.classification = "liability"), THE Transaction_System SHALL record the expense with that accountId
2. THE Ledger_System SHALL increase the liability balance (debt) when expense is recorded on credit card account
3. THE Transaction_System SHALL display credit card balance as a positive number representing debt amount
4. THE Transaction_System SHALL validate that the account exists and is active
5. THE Transaction_System SHALL preserve existing credit card payment logic for transfer transactions

### Requirement 11: Bulk Transaction Account Handling

**User Story:** As a user, I want bulk transactions to use the same account for all items, so that I can quickly record multiple expenses from one shopping trip.

#### Acceptance Criteria

1. WHEN a bulk transaction is submitted, THE AI_Classifier SHALL extract a single accountName for all items
2. THE Transaction_System SHALL apply the same accountId to all transactions in the bulk
3. IF no account is mentioned, THE Transaction_System SHALL return clarification before processing any items
4. THE Transaction_System SHALL validate the accountId once before processing all items
5. WHEN accountId is invalid, THE Transaction_System SHALL reject the entire bulk transaction without partial saves

### Requirement 12: Google Sheets Integration Account Support

**User Story:** As a Google Sheets user, I want my transactions in Sheets to include account information, so that my backup data is complete and consistent.

#### Acceptance Criteria

1. WHEN a transaction is saved to Google Sheets, THE Sheets_Integration SHALL include accountId in the row data
2. THE Sheets_Integration SHALL include account name as a readable column for user reference
3. WHEN reading transactions from Sheets, THE Sheets_Integration SHALL parse accountId and map it to Account records
4. THE Sheets_Integration SHALL handle legacy transactions without accountId gracefully
5. THE Sheets_Integration SHALL maintain backward compatibility with existing Sheets structure

### Requirement 13: Database Transaction Account Support

**User Story:** As an email/password user, I want my transactions stored in the database to include account information, so that my data is complete and queryable.

#### Acceptance Criteria

1. WHEN a transaction is saved to database, THE Transaction_System SHALL include accountId in the Transaction record
2. THE Transaction_System SHALL create proper foreign key relationship between Transaction and Account
3. WHEN querying transactions, THE Transaction_System SHALL support filtering by accountId
4. THE Transaction_System SHALL support joining Account and AccountType data for display
5. THE Transaction_System SHALL maintain existing transaction query performance with proper indexes

### Requirement 14: Account Balance Calculation Preservation

**User Story:** As a user, I want my account balances to be calculated correctly using the existing ledger system, so that my financial data remains accurate after the migration.

#### Acceptance Criteria

1. THE Ledger_System SHALL continue using the existing ledger-based balance calculation
2. THE Ledger_System SHALL calculate balance as: initialBalance + sum(income) - sum(expense) + sum(transfer_in) - sum(transfer_out)
3. THE Transaction_System SHALL not modify the existing account-balance.ts utility functions
4. THE Transaction_System SHALL ensure all new transactions include accountId for balance calculation
5. THE Ledger_System SHALL handle transactions with null accountId (legacy data) by excluding them from balance calculation

### Requirement 15: Migration Path for Existing Data

**User Story:** As a developer, I want a clear migration strategy for existing transactions without accountId, so that the system can transition smoothly to required accountId.

#### Acceptance Criteria

1. THE Transaction_System SHALL document the migration approach for existing null accountId transactions
2. THE Schema_Validator SHALL allow existing transactions with null accountId to remain in database during transition
3. THE Transaction_System SHALL prevent creation of new transactions without accountId
4. THE Transaction_System SHALL provide admin tools or scripts to assign accounts to legacy transactions
5. THE Transaction_System SHALL log warnings when encountering transactions without accountId in balance calculations

### Requirement 16: Error Handling for Invalid Account References

**User Story:** As a user, I want clear error messages when I reference an invalid account, so that I can correct my input quickly.

#### Acceptance Criteria

1. WHEN accountId does not exist, THE Transaction_System SHALL return error "Akun tidak ditemukan"
2. WHEN accountId belongs to another user, THE Transaction_System SHALL return error "Akun tidak valid"
3. WHEN account is inactive (isActive = false), THE Transaction_System SHALL return error "Akun sudah dinonaktifkan"
4. WHEN account is deleted, THE Transaction_System SHALL preserve transaction history with accountId set to null
5. THE Transaction_System SHALL return HTTP 400 status code for invalid account errors

### Requirement 17: Account Selection UI Enhancement

**User Story:** As a user, I want the account selection interface to be intuitive and organized, so that I can quickly find and select the right account.

#### Acceptance Criteria

1. THE Manual_Form SHALL group accounts by AccountType using optgroup elements
2. THE Manual_Form SHALL display account type name as the optgroup label
3. THE Manual_Form SHALL sort accounts alphabetically within each type group
4. THE Manual_Form SHALL disable the option to select the same account as both source and destination in transfers
5. THE Manual_Form SHALL display account currency next to account name when multiple currencies exist

### Requirement 18: AI Classification Response Format

**User Story:** As a developer, I want consistent JSON response format from AI classification, so that the API can reliably process AI output.

#### Acceptance Criteria

1. WHEN AI extracts an account name, THE AI_Classifier SHALL include accountName field in the JSON response
2. THE AI_Classifier SHALL use accountName field for all transaction types (expense, income, transfer, bulk)
3. WHEN no account is mentioned, THE AI_Classifier SHALL omit accountName field (undefined/null)
4. THE AI_Classifier SHALL maintain existing JSON structure for other fields (amount, category, date, note)
5. THE AI_Classifier SHALL validate JSON output conforms to ParsedRecord interface

### Requirement 19: Transfer Transaction Validation

**User Story:** As a user, I want the system to prevent invalid transfers, so that I don't accidentally create incorrect transactions.

#### Acceptance Criteria

1. WHEN creating a transfer, THE Transaction_System SHALL validate that source accountId and destination accountId are different
2. WHEN source and destination are the same, THE Transaction_System SHALL return error "Akun sumber dan tujuan tidak boleh sama"
3. THE Transaction_System SHALL validate both accounts exist and are active
4. THE Transaction_System SHALL validate both accounts belong to the authenticated user
5. THE Transaction_System SHALL preserve existing cross-currency transfer validation

### Requirement 20: API Response Consistency

**User Story:** As a frontend developer, I want consistent API responses for all transaction types, so that I can handle responses uniformly in the UI.

#### Acceptance Criteria

1. WHEN a transaction is successfully created, THE Transaction_System SHALL return the transaction object including accountId
2. THE Transaction_System SHALL include account name in the response for display purposes
3. WHEN returning clarification, THE Transaction_System SHALL use consistent JSON structure with intent "unknown" and clarification message
4. THE Transaction_System SHALL return HTTP 200 for successful operations and HTTP 400 for validation errors
5. THE Transaction_System SHALL include descriptive error messages in the error field for all failure cases
