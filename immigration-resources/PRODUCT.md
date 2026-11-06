# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Course participants and readers using a public resource library. The course owner curates modules and maintains books, links, and references.

## Product Purpose

Organize resources for an immigration and migration course by module, provide a multilingual way to browse them, and let readers ask questions grounded in the saved material.

## Positioning

A course-specific reference library with an owner-managed collection and a hosted open-model assistant that answers from indexed course resources.

## Operating Context

The site is intended for public access. Visitors can browse and ask questions; only the owner can add, edit, or remove resources. The interface is in French; resource records can be in Arabic, French, English, Spanish, or Greek. AI answers and their source labels are in French.

## Capabilities and Constraints

- Organize course materials by module and resource type, including books, links, and references.
- Let the owner add notes and optionally index readable text from an HTTPS resource link.
- Use Groq's hosted open-model API for answers grounded only in the saved resource collection; disclose that questions and selected excerpts are sent to the provider.
- Require admin authentication; do not expose credentials in client code or repository files.
- The hosting provider, domain, and deployment configuration are not yet selected.
- The initial app uses a single server process and a persistent local data file; multi-instance hosting would require a shared database.
- Immigration information varies by country and changes over time. The assistant and library are informational, not legal advice.

## Evidence on Hand

The owner provided these course modules:

- الهجرة و المجتمع المدني:المفاهيم و الرهانات
- مدخل الى سوسيولوجيا الهجرة
- الهجرة و الرقمنة و النوع الاجتماعي
- انثروبولوجيا الحركية و العبور
- السياسات العمومية للهجرة و اللجوء

No course materials, books, or reference links have been supplied yet.

## Product Principles

- Keep resources attributable and organized by the owner's course modules.
- Ground AI answers in saved resources and show the sources used.
- Keep public reading simple and editing access-controlled.
- Avoid legal conclusions and unsupported claims.

## Accessibility & Inclusion

Use plain language, keyboard-operable controls, responsive layouts, and correct bidirectional text behavior for Arabic.
