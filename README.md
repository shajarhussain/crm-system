# CRM System

A centralized Lead Management & CRM Platform designed to ingest leads from Meta Ads, distribute them efficiently to employees, and track the complete lifecycle of customer interactions.

## Features

- **Automated Lead Intake**: Seamless integration with Meta Lead Ads to capture new prospects instantly.
- **Intelligent Distribution**: Time-sensitive, priority-based auto-distribution engine with an 8-lead rotation algorithm to ensure fair and rapid assignment.
- **Immutable Audit Trail**: Permanent, read-only follow-up logging ensures a tamper-proof history of communication and touchpoints.
- **Financial Tracking & Analytics**: Comprehensive deal-entry module that automatically computes gross and net profit, tracks operational expenses, and aggregates performance by employee and campaign.
- **Role-Based Access Control**: Strict segregation of duties between Administrators and Employees, with custom dashboard views and Firebase-enforced data isolation.

## Architecture

- **Frontend**: Next.js App Router.
- **Backend & Business Logic**: Cloud Functions for Firebase.
- **Database**: Cloud Firestore.
- **Task Scheduling**: Cloud Tasks for business-critical SLA monitoring.
- **Authentication**: Firebase Auth with custom role claims.
