# Jabin CRM: Architecture & Value Analysis

This document outlines the system flows of Jabin CRM and explains how it delivers value to the company, hospitals, and technicians.

## 1. System Accuracy Confirmation

The architecture is built on a **Hybrid Field Service & CRM** model. It accurately maps the physical reality of medical equipment management to a digital twin:
- **Sales Funnel**: Digitizes the transition from anonymous Leads to paying Hospitals via Deals, Quotations, and Invoices.
- **Service Lifecycle**: Bridges Equipment (the physical asset) with Support Tickets (the request) and Service Reports (the outcome).
- **Financial Integrity**: Tracks both big-ticket Invoices and small-scale technician "Cash on Hand" or "Travel Expenses."

---

## 2. CRM & Sales Lifecycle (The Growth Engine)
*How the company grows its customer base.*

```mermaid
graph TD
    A[Lead Source] -->|Create Lead| B(Lead Management)
    B -->|Enrichment & Scoring| C{Lead Qualified?}
    C -->|No| D(Lost / Unsubscribed)
    C -->|Yes| E(Deal Pipeline)
    
    E -->|Prospecting| F[Quotation Creation]
    F -->|Proposal| G{Client Approve?}
    G -->|No| E
    G -->|Yes| H[Invoice Generated]
    
    H -->|Payment| I(Converted to Customer)
    I -->|Hospital Entry| J[Equipment Installation]
    
    subgraph Outreach
        L[Email Campaigns]
        M[WhatsApp Messaging]
        N[Follow-up Sequences]
    end
    L -.-> B
    M -.-> B
    N -.-> B
```

---

## 3. Ticketing & Service Workflow (The Operational Core)
*How field operations are managed in real-time.*

```mermaid
graph TD
    A[Hospital / Customer] -->|Create Ticket| B{Queue Management}
    B -->|Assign| C[Field Technician]
    
    C -->|Travel| D[GPS Tracking & Expenses]
    D -->|Site Visit| E[Service Activity]
    
    E -->|On-Site| F[Cash Collection / Parts]
    E -->|Resolution| G[Service Report Ready]
    
    G -->|Approval| H[Ticket Resolved]
    H -->|Portal Notification| I[Customer Notification]
    
    subgraph Operations
        K[Travel Expenses]
        L[Cash on Hand]
        M[Location Logs]
    end
    K --- D
    L --- F
    M --- D
```

---

## 4. Why This System is Helpful

### 🏢 For the Company (CRM Owner)
- **Revenue Protection**: Tracks every quotation and invoice. You never lose sight of a deal or an unpaid service call.
- **Operational Visibility**: Real-time GPS tracking and Service Reports mean you know exactly where your technicians are and what work is being done.
- **Automation**: Marketing sequences and automated reminders (Warranty/SLA) reduce the overhead of manual follow-ups.

### 🏥 For Hospitals (The Customer)
- **Transparency**: The Hospital Portal gives them a "Single Source of Truth." They can see their service history, warranty status, and ticket progress without calling.
- **Asset Management**: They can track every piece of equipment installed, knowing when the last maintenance happened and when the next one is due.
- **Faster Resolution**: Direct ticket creation and real-time updates ensure equipment downtime is minimized.

### 🛠️ For Technicians (The Field Staff)
- **Digital Reporting**: No more manual paper reports. Technicians can log notes directly on-site and generate professional PDF reports instantly.
- **Financial Ease**: Simple tracking of "Cash on Hand" for small parts and automated "Travel Expense" logging for fuel and lodging.
- **Accountability**: GPS logging provides "Proof of Visit," protecting the technician and the company from disputes.

---

## 5. Combined System Integration
*The unified view of Sales and Service.*

```mermaid
graph LR
    subgraph "Sales (CRM)"
        Lead[Leads / Deals]
        Sale[Converted Sale]
    end
    
    subgraph "Service (Ticketing)"
        Ticket[Support Ticket]
        Report[Service Report]
    end
    
    subgraph "Central Entities"
        Hosp[Customer - Hospital]
        Equip[Equipment Installation]
        User[Staff / Tech / Admin]
    end

    Lead -->|Conversion| Hosp
    Sale -->|Installation| Equip
    Hosp --- Equip
    
    Equip -->|Issue| Ticket
    Ticket -->|Work| Report
    Report -->|Update| Equip
    
    User -->|Manages| Lead
    User -->|Resolves| Ticket
    
    subgraph "Cross-System Features"
        Notif[Notification System]
        Work[Automated Workflows]
        Audit[Audit Logs]
    end
    
    Notif -.-> Lead
    Notif -.-> Ticket
    Work -.-> Lead
    Work -.-> Ticket
```
