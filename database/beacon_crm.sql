--
-- PostgreSQL database dump
--

\restrict zHCliWKn1jG0cDkHmGoKQ9ILaJTrK5MqzxzatXuEqBmdLnnopXVCKrv2KCO3GOv

-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.9

-- Started on 2026-07-22 19:28:15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 875 (class 1247 OID 42894)
-- Name: activitytypeenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activitytypeenum AS ENUM (
    'call',
    'email',
    'meeting',
    'internal'
);


ALTER TYPE public.activitytypeenum OWNER TO postgres;

--
-- TOC entry 866 (class 1247 OID 42856)
-- Name: approvalstatusenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.approvalstatusenum AS ENUM (
    'draft',
    'in_review',
    'approved',
    'rejected'
);


ALTER TYPE public.approvalstatusenum OWNER TO postgres;

--
-- TOC entry 872 (class 1247 OID 42880)
-- Name: dealdoctypeenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dealdoctypeenum AS ENUM (
    'qualification_notes',
    'proposal',
    'negotiation_terms',
    'contract',
    'invoice',
    'other'
);


ALTER TYPE public.dealdoctypeenum OWNER TO postgres;

--
-- TOC entry 869 (class 1247 OID 42866)
-- Name: dealstageenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.dealstageenum AS ENUM (
    'baru',
    'kualifikasi',
    'proposal',
    'negosiasi',
    'closed_won',
    'closed_lost'
);


ALTER TYPE public.dealstageenum OWNER TO postgres;

--
-- TOC entry 878 (class 1247 OID 42904)
-- Name: interactiontypeenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.interactiontypeenum AS ENUM (
    'call',
    'email',
    'meeting',
    'note'
);


ALTER TYPE public.interactiontypeenum OWNER TO postgres;

--
-- TOC entry 863 (class 1247 OID 42850)
-- Name: leadcaptureenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.leadcaptureenum AS ENUM (
    'manual',
    'whatsapp'
);


ALTER TYPE public.leadcaptureenum OWNER TO postgres;

--
-- TOC entry 860 (class 1247 OID 42840)
-- Name: leadstatusenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.leadstatusenum AS ENUM (
    'new',
    'contacted',
    'qualified',
    'unqualified'
);


ALTER TYPE public.leadstatusenum OWNER TO postgres;

--
-- TOC entry 902 (class 1247 OID 43033)
-- Name: projectstatusenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.projectstatusenum AS ENUM (
    'planning',
    'ongoing',
    'completed',
    'cancelled'
);


ALTER TYPE public.projectstatusenum OWNER TO postgres;

--
-- TOC entry 908 (class 1247 OID 43050)
-- Name: purchasestatusenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.purchasestatusenum AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected',
    'ordered',
    'received',
    'completed'
);


ALTER TYPE public.purchasestatusenum OWNER TO postgres;

--
-- TOC entry 905 (class 1247 OID 43042)
-- Name: purchasetypeenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.purchasetypeenum AS ENUM (
    'request',
    'order',
    'return_'
);


ALTER TYPE public.purchasetypeenum OWNER TO postgres;

--
-- TOC entry 857 (class 1247 OID 42832)
-- Name: roleenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.roleenum AS ENUM (
    'admin',
    'manager',
    'sales'
);


ALTER TYPE public.roleenum OWNER TO postgres;

--
-- TOC entry 911 (class 1247 OID 43066)
-- Name: stockmovementtypeenum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.stockmovementtypeenum AS ENUM (
    'in_',
    'out',
    'adjustment',
    'return_out'
);


ALTER TYPE public.stockmovementtypeenum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 223 (class 1259 OID 43009)
-- Name: activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activities (
    id uuid NOT NULL,
    lead_id uuid,
    deal_id uuid,
    owner_id uuid,
    type public.activitytypeenum NOT NULL,
    title character varying NOT NULL,
    due_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.activities OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 42922)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid NOT NULL,
    name character varying NOT NULL,
    contact_name character varying,
    phone character varying,
    email character varying,
    channel character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 42991)
-- Name: deal_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_documents (
    id uuid NOT NULL,
    deal_id uuid NOT NULL,
    stage public.dealstageenum NOT NULL,
    doc_type public.dealdoctypeenum NOT NULL,
    label character varying NOT NULL,
    url character varying NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.deal_documents OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 42954)
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid NOT NULL,
    lead_id uuid NOT NULL,
    title character varying NOT NULL,
    value numeric(14,2),
    stage public.dealstageenum NOT NULL,
    ai_probability integer,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.deals OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 42973)
-- Name: interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interactions (
    id uuid NOT NULL,
    lead_id uuid NOT NULL,
    created_by uuid,
    type public.interactiontypeenum NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.interactions OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 42930)
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id uuid NOT NULL,
    name character varying NOT NULL,
    company character varying NOT NULL,
    role_title character varying,
    email character varying,
    phone character varying,
    status public.leadstatusenum NOT NULL,
    source character varying,
    customer_id uuid,
    capture_method public.leadcaptureenum NOT NULL,
    vendor_name character varying,
    description text,
    budget numeric(14,2),
    timeline character varying,
    approval_status public.approvalstatusenum NOT NULL,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    review_note text,
    ai_score integer,
    ai_score_reason text,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    last_activity_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 43094)
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    sku character varying,
    name character varying NOT NULL,
    unit character varying,
    category character varying,
    unit_price numeric(14,2),
    reorder_level integer,
    stock_qty integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.products OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 43075)
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid NOT NULL,
    deal_id uuid NOT NULL,
    name character varying NOT NULL,
    budget numeric(14,2),
    status public.projectstatusenum NOT NULL,
    owner_id uuid,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 43149)
-- Name: purchase_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_items (
    id uuid NOT NULL,
    purchase_id uuid NOT NULL,
    product_id uuid NOT NULL,
    qty integer NOT NULL,
    unit_price numeric(14,2)
);


ALTER TABLE public.purchase_items OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 43102)
-- Name: purchases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchases (
    id uuid NOT NULL,
    number character varying NOT NULL,
    type public.purchasetypeenum NOT NULL,
    status public.purchasestatusenum NOT NULL,
    project_id uuid,
    vendor_name character varying,
    notes text,
    requested_by uuid,
    approved_by uuid,
    source_purchase_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.purchases OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 43131)
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id uuid NOT NULL,
    product_id uuid NOT NULL,
    type public.stockmovementtypeenum NOT NULL,
    qty integer NOT NULL,
    reference character varying,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 42913)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    password_hash character varying NOT NULL,
    role public.roleenum NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 4987 (class 0 OID 43009)
-- Dependencies: 223
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activities (id, lead_id, deal_id, owner_id, type, title, due_at, completed_at, created_at) FROM stdin;
6ed7df47-c82c-4af6-9956-0ac866527874	6bd04e69-58c6-40ae-b542-da3b7bd1981d	\N	f7f5c496-3eb0-4940-8e75-e78982807a2e	call	Follow-up ke PT Maju Bersama	2026-07-11 04:17:05.114374+07	2026-07-11 05:17:05.114374+07	2026-07-11 06:17:06.383474+07
276dd666-d38c-4d58-b30e-f8709cad21c1	61e6bf51-12f8-45a5-9318-02921df6df7f	\N	e7c07c29-f33c-472a-ba13-7f65d6eb5796	email	Kirim ulang proposal ke CV Berkah Jaya	2026-07-11 08:17:05.114374+07	\N	2026-07-11 06:17:06.383474+07
4f12a985-ccca-4972-a187-02c27f2f090f	165d46b0-514b-4c85-944b-387eb9227ccc	\N	f7f5c496-3eb0-4940-8e75-e78982807a2e	meeting	Diskusi kontrak dengan Andi Wijaya Group	2026-07-12 06:17:05.114374+07	\N	2026-07-11 06:17:06.383474+07
1ac9e677-99ec-4519-945e-6e9a9c0d31a1	8b1036c7-3492-450f-bb94-f213fc23c90a	\N	43005786-4665-443d-b16a-fb629e4e19a9	internal	Cek invoice dari Surya Abadi Tech	2026-07-09 06:17:05.114374+07	\N	2026-07-11 06:17:06.383474+07
\.


--
-- TOC entry 4982 (class 0 OID 42922)
-- Dependencies: 218
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, name, contact_name, phone, email, channel, created_at) FROM stdin;
0af732e5-edb3-486f-97ec-3c4c436dc89d	PT Nusantara Digital	Budi Santoso	+62 812-3456-7890	budi@nusantara-digital.id	WhatsApp	2026-07-11 06:17:06.337609+07
8fdfb8d5-7845-457a-b7e7-78fbc6407a6f	CV Berkah Jaya	Siti Rahma	+62 813-1111-2222	siti@berkahjaya.id	Referral	2026-07-11 06:17:06.337609+07
47481270-4e84-4f8e-aa39-94e64a6455d0	Andi Wijaya Group	Andi Wijaya	+62 813-2222-3333	andi@awgroup.id	Event	2026-07-11 06:17:06.337609+07
fd9ca0b9-d617-4054-aa5e-a981712bba9a	Sumber Rejeki Tani	Putri Lestari	+62 813-3333-4444	putri@sumberrejeki.id	Cold outreach	2026-07-11 06:17:06.337609+07
f65eed71-a391-4d43-8bcf-ae6ecbec1575	Maju Bersama Tbk	Rina Wulandari	+62 813-4444-5555	rina@majubersama.id	WhatsApp	2026-07-11 06:17:06.337609+07
744ecdb0-5de1-4884-940a-b0df278c37ee	PT Sejahtera Makmur	Eka Wijaya	+62 813-5555-6666	eka@sejahteramakmur.id	Referral	2026-07-11 06:17:06.337609+07
3b7eeaf9-d206-4972-802f-fec322276472	CV Abadi Sentosa	Joko Susanto	+62 813-6666-7777	joko@abadisentosa.id	Event	2026-07-11 06:17:06.337609+07
d6610ba2-e59a-440b-a150-c4233be685f3	Surya Abadi Tech	Bagas Pratama	+62 813-7777-8888	bagas@suryaabadi.id	Referral	2026-07-11 06:17:06.337609+07
ec0c6ba3-52e5-4797-962e-a6bbd5546d53	PT Cakra Mandiri	Hendra Saputra	+62 812-9999-1111	hendra@cakramandiri.id	Cold outreach	2026-07-11 06:17:06.337609+07
dd5828bc-748f-41ef-9e39-205660051092	Toko Sinar Abadi	Lina Marlina	+62 812-8888-2222	lina@sinarabadi.id	WhatsApp	2026-07-11 06:17:06.337609+07
8e8b18cd-6954-494e-9b4f-1b0b69570f49	Warung Kita Group	Yoga Saputro	+62 812-7777-3333	yoga@warungkita.id	Cold outreach	2026-07-11 06:17:06.337609+07
\.


--
-- TOC entry 4986 (class 0 OID 42991)
-- Dependencies: 222
-- Data for Name: deal_documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deal_documents (id, deal_id, stage, doc_type, label, url, note, created_by, created_at) FROM stdin;
666b028f-b698-4986-8337-114fd6d63d0a	85cfcf4a-e3c4-4460-9df4-61d7f8828cb5	kualifikasi	qualification_notes	Catatan kebutuhan	https://drive.google.com/file/d/contoh-catatan-kebutuhan-berkah-jaya	Hasil diskusi awal: butuh paket distribusi buat 3 gudang, mulai Q3.	e7c07c29-f33c-472a-ba13-7f65d6eb5796	2026-07-11 05:17:05.114374+07
cfea9010-c31f-4f8e-9e27-d5047a3bfb7e	87bc39a9-aae2-45a3-ad01-d7e1eaa54851	proposal	proposal	Dokumen Proposal	https://drive.google.com/file/d/contoh-proposal-andi-wijaya-group	Proposal kontrak korporat 1 tahun, termasuk implementasi + training tim. Revisi terakhir sesuai request budget direksi.	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-09 06:17:05.114374+07
6334048b-68c8-44b5-a15b-4d9b234b801a	5906e82d-bed5-465e-a7cc-3c29bfa199a4	closed_won	contract	Kontrak Final	https://drive.google.com/file/d/contoh-kontrak-surya-abadi-tech	Kontrak tahunan udah ditandatangani kedua pihak.	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-01 06:17:05.114374+07
c35a21f1-d12b-4f31-a68f-bed743a9f136	ea3bcbf8-5581-45ec-a0e4-b1c7cf99dcbf	closed_won	contract	Kontrak Final	https://drive.google.com/file/d/contoh-kontrak-sejahtera-makmur	Kontrak tahunan, otomatis diperpanjang tahun depan.	43005786-4665-443d-b16a-fb629e4e19a9	2026-05-02 06:17:05.114374+07
f06a153b-bf65-4b65-9233-077f7b4c1697	65b77b4e-4597-4427-8c3e-62f463fbab4d	closed_won	contract	Kontrak Final	https://drive.google.com/file/d/contoh-kontrak-abadi-sentosa	Kontrak tahunan udah aktif jalan.	1965a211-ebea-4edd-b340-cfb298f02e24	2026-04-22 06:17:05.114374+07
\.


--
-- TOC entry 4984 (class 0 OID 42954)
-- Dependencies: 220
-- Data for Name: deals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deals (id, lead_id, title, value, stage, ai_probability, owner_id, created_at, updated_at) FROM stdin;
5906e82d-bed5-465e-a7cc-3c29bfa199a4	8b1036c7-3492-450f-bb94-f213fc23c90a	Surya Abadi Tech : kontrak tahunan	142000000.00	closed_won	100	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-11 06:17:06.370015+07	2026-07-11 06:17:06.406217+07
65b77b4e-4597-4427-8c3e-62f463fbab4d	0663f319-c707-4119-8894-9fae20990c8b	CV Abadi Sentosa : kontrak tahunan	56000000.00	closed_won	97	1965a211-ebea-4edd-b340-cfb298f02e24	2026-07-11 06:17:06.370015+07	2026-07-11 06:17:06.406217+07
85cfcf4a-e3c4-4460-9df4-61d7f8828cb5	61e6bf51-12f8-45a5-9318-02921df6df7f	CV Berkah Jaya : paket tahunan	47000000.00	kualifikasi	36	e7c07c29-f33c-472a-ba13-7f65d6eb5796	2026-07-11 06:17:06.370015+07	2026-07-11 06:17:06.406217+07
87bc39a9-aae2-45a3-ad01-d7e1eaa54851	165d46b0-514b-4c85-944b-387eb9227ccc	Andi Wijaya Group : kontrak korporat	120000000.00	proposal	56	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-11 06:17:06.370015+07	2026-07-11 06:17:06.406217+07
95354fc0-1c15-4e15-8473-1a843a7734b4	6bd04e69-58c6-40ae-b542-da3b7bd1981d	Maju Bersama Tbk : pilot project	65000000.00	baru	12	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-11 06:17:06.370015+07	2026-07-11 06:17:06.406217+07
d63f1c62-86ba-47da-85a1-7265be322785	7245f174-2076-4103-999f-c2dafab629a9	PT Nusantara Digital : implementasi awal	89000000.00	kualifikasi	39	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-11 06:17:06.370015+07	2026-07-11 06:17:06.406217+07
ea3bcbf8-5581-45ec-a0e4-b1c7cf99dcbf	6d459628-23a2-48c7-9bd5-107259ce481e	PT Sejahtera Makmur : kontrak tahunan	98000000.00	closed_won	98	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-11 06:17:06.370015+07	2026-07-11 06:17:06.406217+07
\.


--
-- TOC entry 4985 (class 0 OID 42973)
-- Dependencies: 221
-- Data for Name: interactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.interactions (id, lead_id, created_by, type, note, created_at) FROM stdin;
fdfe6a63-6102-4d0e-9978-7ed93bf66c19	7245f174-2076-4103-999f-c2dafab629a9	f7f5c496-3eb0-4940-8e75-e78982807a2e	call	Menelepon, bahas kebutuhan & budget. Aktif diskusi soal harga.	2026-07-11 06:07:05.114374+07
52616a75-d7bd-49c3-86a2-563771d21603	7245f174-2076-4103-999f-c2dafab629a9	f7f5c496-3eb0-4940-8e75-e78982807a2e	meeting	Meeting di-reschedule ke minggu depan (2x reschedule).	2026-07-10 06:17:05.114374+07
f3b9c03c-7715-445c-bbb9-ddd7d78174e1	7245f174-2076-4103-999f-c2dafab629a9	f7f5c496-3eb0-4940-8e75-e78982807a2e	email	Mengirim brosur produk & price list.	2026-07-08 06:17:05.114374+07
cbe5071e-dfee-4a3f-92e4-b07c80e13445	61e6bf51-12f8-45a5-9318-02921df6df7f	e7c07c29-f33c-472a-ba13-7f65d6eb5796	email	Mengirim proposal awal ke CV Berkah Jaya.	2026-07-11 05:17:05.114374+07
52caaddb-a160-44fc-ba43-3e737356308c	165d46b0-514b-4c85-944b-387eb9227ccc	f7f5c496-3eb0-4940-8e75-e78982807a2e	call	Kontak pertama via telepon, Andi tertarik & minta dikirim proposal lengkap.	2026-07-02 06:17:05.114374+07
b8021e87-fa53-4f9b-a3e4-312c4d53925b	165d46b0-514b-4c85-944b-387eb9227ccc	f7f5c496-3eb0-4940-8e75-e78982807a2e	meeting	Meeting presentasi produk di kantor Andi Wijaya Group, dihadiri tim procurement.	2026-07-05 06:17:05.114374+07
782d2d9e-ab48-4d8d-800a-06d42de4b7ac	165d46b0-514b-4c85-944b-387eb9227ccc	f7f5c496-3eb0-4940-8e75-e78982807a2e	email	Mengirim dokumen proposal kontrak korporat dan nunggu review internal mereka.	2026-07-09 06:17:05.114374+07
4460cb99-0ded-4fbc-a9d3-c8f291b4e659	165d46b0-514b-4c85-944b-387eb9227ccc	f7f5c496-3eb0-4940-8e75-e78982807a2e	note	Andi minta waktu sampai akhir bulan buat keputusan internal, budget udah disetujui direksi.	2026-07-11 02:17:05.114374+07
d3bb6440-ad43-4ce2-92c1-b7ddfa630dae	6bd04e69-58c6-40ae-b542-da3b7bd1981d	f7f5c496-3eb0-4940-8e75-e78982807a2e	email	Mengirim info awal soal pilot project ke Rina, nunggu balasan.	2026-07-09 06:17:05.114374+07
5adab4fc-6e36-4afb-bc6c-88e379864688	519c52bd-e486-4377-bc6f-0fc2d6b61140	e7c07c29-f33c-472a-ba13-7f65d6eb5796	call	Nelepon buat follow-up, Putri bilang masih riset harga kompetitor.	2026-07-06 06:17:05.114374+07
d8b4cd20-17cf-4fca-90ca-6b2b46b6d861	6d459628-23a2-48c7-9bd5-107259ce481e	43005786-4665-443d-b16a-fb629e4e19a9	meeting	Meeting review tahunan, PT Sejahtera Makmur puas sama implementasi.	2026-06-19 06:17:05.114374+07
ebb21027-0c04-4666-a4b0-b642a07984e8	6d459628-23a2-48c7-9bd5-107259ce481e	43005786-4665-443d-b16a-fb629e4e19a9	note	Kontrak diperpanjang otomatis buat tahun depan.	2026-06-21 06:17:05.114374+07
8abf3ef0-7908-488a-b34c-e95b74273a14	0663f319-c707-4119-8894-9fae20990c8b	1965a211-ebea-4edd-b340-cfb298f02e24	email	Mengirim laporan pemakaian Q2 ke CV Abadi Sentosa.	2026-06-16 06:17:05.114374+07
50763eaf-4241-4c65-9d74-c0ea15a4eb36	8b1036c7-3492-450f-bb94-f213fc23c90a	43005786-4665-443d-b16a-fb629e4e19a9	call	Diskusi penambahan seat buat tim engineering Surya Abadi Tech.	2026-07-08 06:17:05.114374+07
\.


--
-- TOC entry 4983 (class 0 OID 42930)
-- Dependencies: 219
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leads (id, name, company, role_title, email, phone, status, source, customer_id, capture_method, vendor_name, description, budget, timeline, approval_status, submitted_at, reviewed_at, reviewed_by, review_note, ai_score, ai_score_reason, owner_id, created_at, last_activity_at) FROM stdin;
afc606e6-d5cc-4163-9958-5a28f77f8749	Lina Marlina	Toko Sinar Abadi	Owner	lina@sinarabadi.id	+62 812-8888-2222	new	Website	dd5828bc-748f-41ef-9e39-205660051092	whatsapp	Toko Sinar Abadi		\N	\N	draft	\N	\N	\N	\N	\N	\N	1965a211-ebea-4edd-b340-cfb298f02e24	2026-07-11 06:17:06.355684+07	2026-07-11 05:17:05.114374+07
0663f319-c707-4119-8894-9fae20990c8b	Joko Susanto	CV Abadi Sentosa	Owner	joko@abadisentosa.id	+62 813-6666-7777	qualified	Event	3b7eeaf9-d206-4972-802f-fec322276472	manual	CV Abadi Sentosa	Kontrak tahunan, udah closed won.	56000000.00	1 tahun	approved	2026-06-15 06:17:05.114374+07	2026-06-15 06:17:05.114374+07	\N	\N	85	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	1965a211-ebea-4edd-b340-cfb298f02e24	2026-07-11 06:17:06.340661+07	2026-06-16 06:17:05.114374+07
11914aff-359e-428f-81c1-c7dc1aca2f2f	Yoga Saputro	Warung Kita Group	Procurement	yoga@warungkita.id	+62 812-7777-3333	new	Cold outreach	8e8b18cd-6954-494e-9b4f-1b0b69570f49	manual	Warung Kita Group	Cuma nanya-nanya harga, pas mau prepare proposal ngilang.	20000000.00	2 bulan	rejected	2026-07-09 06:17:05.114374+07	2026-07-10 06:17:05.114374+07	e7c07c29-f33c-472a-ba13-7f65d6eb5796	Sinyal lead bodong itu gak ada follow-up balik 2 minggu, kemungkinan cuma survey harga.	30	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-11 06:17:06.355684+07	2026-07-10 06:17:05.114374+07
165d46b0-514b-4c85-944b-387eb9227ccc	Andi Wijaya	Andi Wijaya Group	CEO	andi@awgroup.id	+62 813-2222-3333	qualified	Event	47481270-4e84-4f8e-aa39-94e64a6455d0	manual	Andi Wijaya Group	Kontrak korporat skala grup, multi-cabang.	120000000.00	Q4 2026	approved	2026-07-09 06:17:05.114374+07	2026-07-09 06:17:05.114374+07	\N	\N	96	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-11 06:17:06.340661+07	2026-07-10 06:17:05.114374+07
519c52bd-e486-4377-bc6f-0fc2d6b61140	Putri Lestari	Sumber Rejeki Tani	Owner	putri@sumberrejeki.id	+62 813-3333-4444	unqualified	Cold outreach	fd9ca0b9-d617-4054-aa5e-a981712bba9a	manual	Sumber Rejeki Tani	Awalnya nanya-nanya soal harga, gak lanjut.	15000000.00	-	approved	2026-07-05 06:17:05.114374+07	2026-07-05 06:17:05.114374+07	\N	\N	7	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	e7c07c29-f33c-472a-ba13-7f65d6eb5796	2026-07-11 06:17:06.340661+07	2026-07-06 06:17:05.114374+07
61e6bf51-12f8-45a5-9318-02921df6df7f	Siti Rahma	CV Berkah Jaya	Manager	siti@berkahjaya.id	+62 813-1111-2222	contacted	Referral	8fdfb8d5-7845-457a-b7e7-78fbc6407a6f	manual	CV Berkah Jaya	Paket tahunan buat distribusi produk consumer goods.	47000000.00	2 bulan	approved	2026-07-09 06:17:05.114374+07	2026-07-09 06:17:05.114374+07	\N	\N	73	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	e7c07c29-f33c-472a-ba13-7f65d6eb5796	2026-07-11 06:17:06.340661+07	2026-07-10 06:17:05.114374+07
6bd04e69-58c6-40ae-b542-da3b7bd1981d	Rina Wulandari	Maju Bersama Tbk	Finance	rina@majubersama.id	+62 813-4444-5555	new	Website	f65eed71-a391-4d43-8bcf-ae6ecbec1575	whatsapp	Maju Bersama Tbk	Pilot project buat divisi finance sebelum scale up.	65000000.00	6 minggu	approved	2026-07-08 06:17:05.114374+07	2026-07-08 06:17:05.114374+07	\N	\N	48	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-11 06:17:06.340661+07	2026-07-09 06:17:05.114374+07
6d459628-23a2-48c7-9bd5-107259ce481e	Eka Wijaya	PT Sejahtera Makmur	Procurement	eka@sejahteramakmur.id	+62 813-5555-6666	qualified	Referral	744ecdb0-5de1-4884-940a-b0df278c37ee	manual	PT Sejahtera Makmur	Kontrak tahunan, udah closed won.	98000000.00	1 tahun	approved	2026-06-18 06:17:05.114374+07	2026-06-18 06:17:05.114374+07	\N	\N	100	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-11 06:17:06.340661+07	2026-06-19 06:17:05.114374+07
7245f174-2076-4103-999f-c2dafab629a9	Budi Santoso	PT Nusantara Digital	Head of Ops	budi@nusantara-digital.id	+62 812-3456-7890	new	Website	0af732e5-edb3-486f-97ec-3c4c436dc89d	whatsapp	PT Nusantara Digital	Implementasi sistem CRM internal buat tim sales mereka.	90000000.00	Q3 2026	approved	2026-07-10 06:17:05.114374+07	2026-07-10 06:17:05.114374+07	\N	\N	60	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-11 06:17:06.340661+07	2026-07-11 06:17:05.114374+07
8b1036c7-3492-450f-bb94-f213fc23c90a	Bagas Pratama	Surya Abadi Tech	CTO	bagas@suryaabadi.id	+62 813-7777-8888	qualified	Referral	d6610ba2-e59a-440b-a150-c4233be685f3	manual	Surya Abadi Tech	Kontrak tahunan, udah closed won.	142000000.00	1 tahun	approved	2026-07-07 06:17:05.114374+07	2026-07-07 06:17:05.114374+07	\N	\N	89	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-11 06:17:06.340661+07	2026-07-08 06:17:05.114374+07
8d54dc26-0293-49c6-9be1-71d9da1c7b8f	Budi Santoso	PT Nusantara Digital	Head of Ops	budi@nusantara-digital.id	+62 812-3456-7890	qualified	WhatsApp	0af732e5-edb3-486f-97ec-3c4c436dc89d	whatsapp	PT Nusantara Digital	Nanya-nanya soal nambah modul reporting, terpisah dari proyek CRM yang lagi jalan.	32000000.00	Q1 2027	approved	2026-07-02 06:17:05.114374+07	2026-07-02 06:17:05.114374+07	\N	\N	80	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	f7f5c496-3eb0-4940-8e75-e78982807a2e	2026-07-11 06:17:06.355684+07	2026-07-03 06:17:05.114374+07
dc739e8a-0178-40c6-a73a-82ee9bc740cf	Hendra Saputra	PT Cakra Mandiri	Purchasing Manager	hendra@cakramandiri.id	+62 812-9999-1111	new	Cold outreach	ec0c6ba3-52e5-4797-962e-a6bbd5546d53	manual	PT Cakra Mandiri	Mau implementasi sistem buat tim purchasing, masih awal banget diskusinya.	40000000.00	Q1 2027	in_review	2026-07-11 02:17:05.114374+07	\N	\N	\N	28	Estimasi otomatis dari status, sumber, dan jumlah interaksi (mode fallback).	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-11 06:17:06.355684+07	2026-07-11 02:17:05.114374+07
\.


--
-- TOC entry 4989 (class 0 OID 43094)
-- Dependencies: 225
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, sku, name, unit, category, unit_price, reorder_level, stock_qty, created_at) FROM stdin;
3b3ea843-1acf-4fb0-8fc2-9789b6d05601	NET-001	Switch Jaringan 24 Port	unit	Hardware	4800000.00	3	2	2026-07-17 10:34:39.139674+07
df85b2b5-8010-4ee0-9bb6-deb29cd3950c	SUP-001	Paket Support & Maintenance 1 Tahun	paket	Jasa	15000000.00	0	8	2026-07-17 10:34:39.139674+07
2e51052b-41c1-4ba1-9d1b-f78dc17e87eb	SRV-001	Server Rack Unit 2U	unit	Hardware	18500000.00	2	7	2026-07-17 10:34:39.139674+07
c09d9248-41a5-43a6-ab4a-f6a0bc138ac5	LIC-001	Lisensi Software (per seat)	lisensi	Software	1200000.00	10	55	2026-07-17 10:34:39.139674+07
00791eba-b3ce-4fdc-9e4a-aa50b5fb4ee3	CBL-001	Kabel Fiber Optic 100m	roll	Consumable	950000.00	5	13	2026-07-17 10:34:39.139674+07
\.


--
-- TOC entry 4988 (class 0 OID 43075)
-- Dependencies: 224
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, deal_id, name, budget, status, owner_id, start_date, end_date, notes, created_at, updated_at) FROM stdin;
366a2a3f-2b7d-427b-a3b1-2c7bb7fd57e6	5906e82d-bed5-465e-a7cc-3c29bfa199a4	Implementasi Sistem — Surya Abadi Tech	45000000.00	ongoing	43005786-4665-443d-b16a-fb629e4e19a9	2026-07-09 10:34:39.148106+07	\N	Rollout server + lisensi buat kantor pusat.	2026-07-17 10:34:39.154359+07	2026-07-17 10:34:39.154359+07
69cb51d0-1cd3-4b36-9997-d1cb0620d935	65b77b4e-4597-4427-8c3e-62f463fbab4d	Setup Jaringan — CV Abadi Sentosa	20000000.00	planning	1965a211-ebea-4edd-b340-cfb298f02e24	2026-07-15 10:34:39.148106+07	\N	Perluasan jaringan cabang baru.	2026-07-17 10:34:39.154359+07	2026-07-17 10:34:39.154359+07
\.


--
-- TOC entry 4992 (class 0 OID 43149)
-- Dependencies: 228
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_items (id, purchase_id, product_id, qty, unit_price) FROM stdin;
be9098a3-e2fb-4c9b-ada6-486f86e1d643	9ae103bc-c448-409b-bf6c-54cf31a7ce00	2e51052b-41c1-4ba1-9d1b-f78dc17e87eb	2	18500000.00
2ff12f17-99b0-4613-8e9e-c1f0a8379cc9	9ae103bc-c448-409b-bf6c-54cf31a7ce00	c09d9248-41a5-43a6-ab4a-f6a0bc138ac5	15	1200000.00
9574792a-0146-42d5-8efc-7a8605a028a3	a59bb4c1-cbfe-469d-a79b-5273e39d1946	3b3ea843-1acf-4fb0-8fc2-9789b6d05601	3	4800000.00
4cf3be73-cd21-4da4-9d4a-8a875a95dcdf	a59bb4c1-cbfe-469d-a79b-5273e39d1946	00791eba-b3ce-4fdc-9e4a-aa50b5fb4ee3	6	950000.00
8fd7939f-58cb-4b9b-b8fc-dec51e200395	daa00e72-f316-4015-9ffa-51d445ac3e02	2e51052b-41c1-4ba1-9d1b-f78dc17e87eb	1	18500000.00
\.


--
-- TOC entry 4990 (class 0 OID 43102)
-- Dependencies: 226
-- Data for Name: purchases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchases (id, number, type, status, project_id, vendor_name, notes, requested_by, approved_by, source_purchase_id, created_at, updated_at) FROM stdin;
a59bb4c1-cbfe-469d-a79b-5273e39d1946	PR-0001	request	submitted	69cb51d0-1cd3-4b36-9997-d1cb0620d935	\N	Butuh switch + kabel buat perluasan jaringan cabang baru.	1965a211-ebea-4edd-b340-cfb298f02e24	\N	\N	2026-07-17 10:34:39.169694+07	2026-07-17 10:34:39.169694+07
daa00e72-f316-4015-9ffa-51d445ac3e02	RET-0001	return_	submitted	366a2a3f-2b7d-427b-a3b1-2c7bb7fd57e6	PT Sumber Elektronik	1 unit server rack cacat fisik pas unboxing, dibalikin ke vendor.	43005786-4665-443d-b16a-fb629e4e19a9	\N	9ae103bc-c448-409b-bf6c-54cf31a7ce00	2026-07-17 10:34:39.172212+07	2026-07-17 10:34:39.172212+07
9ae103bc-c448-409b-bf6c-54cf31a7ce00	PO-0001	order	received	366a2a3f-2b7d-427b-a3b1-2c7bb7fd57e6	PT Sumber Elektronik	Server + lisensi buat project Surya Abadi Tech.	43005786-4665-443d-b16a-fb629e4e19a9	e7c07c29-f33c-472a-ba13-7f65d6eb5796	\N	2026-07-17 10:34:39.16265+07	2026-07-17 10:34:39.177874+07
\.


--
-- TOC entry 4991 (class 0 OID 43131)
-- Dependencies: 227
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_movements (id, product_id, type, qty, reference, note, created_by, created_at) FROM stdin;
f04d5ef5-75ec-4af7-bc86-e43e7fb22351	2e51052b-41c1-4ba1-9d1b-f78dc17e87eb	in_	2	PO-0001	Barang diterima dari PO PO-0001	e7c07c29-f33c-472a-ba13-7f65d6eb5796	2026-07-13 10:34:39.148106+07
98e4cb37-45d4-41c2-8808-e43ca57f027d	c09d9248-41a5-43a6-ab4a-f6a0bc138ac5	in_	15	PO-0001	Barang diterima dari PO PO-0001	e7c07c29-f33c-472a-ba13-7f65d6eb5796	2026-07-13 10:34:39.148106+07
9a7a99cb-d9b0-404d-bc0d-82eee2977b44	00791eba-b3ce-4fdc-9e4a-aa50b5fb4ee3	adjustment	1	Manual	\N	e7c07c29-f33c-472a-ba13-7f65d6eb5796	2026-07-21 10:22:47.470865+07
\.


--
-- TOC entry 4981 (class 0 OID 42913)
-- Dependencies: 217
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email, password_hash, role, created_at) FROM stdin;
f54fd550-66e8-4939-8817-831936d47e4c	Daniel	daniel@beacon.id	$2b$12$SaMu4c491nHMJjPWP2U1C.wdfkIz4e4T4.mwrm79wvYmQbzzWE5jq	admin	2026-07-11 06:17:05.112079+07
e7c07c29-f33c-472a-ba13-7f65d6eb5796	Nadia Putri	nadia@beacon.id	$2b$12$IcVo9dIBrKmLMlztb7zNG.FfZNailwTkbr2cXG0QKeMmhr55EM1q2	manager	2026-07-11 06:17:05.112079+07
f7f5c496-3eb0-4940-8e75-e78982807a2e	Dimas Pradana	dimas@beacon.id	$2b$12$0aDOmYuWqlvKoC35v4Lfd.J6Bq8HDL4XgAfKB75Fy608slsraxxMe	sales	2026-07-11 06:17:05.112079+07
43005786-4665-443d-b16a-fb629e4e19a9	Rizky Pratama	rizky@beacon.id	$2b$12$o2Zy1lfdO5tBj9Tg.ReBCOanTamorZxn74COZFVHfsjq.517.IDLu	sales	2026-07-11 06:17:05.112079+07
1965a211-ebea-4edd-b340-cfb298f02e24	Fajar Nugroho	fajar@beacon.id	$2b$12$fCC1UQEkqGpq799qs4f0He13PcZysvum8TS5JRnUiGroPBuTtgaa6	sales	2026-07-11 06:17:05.112079+07
\.


--
-- TOC entry 4803 (class 2606 OID 43016)
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- TOC entry 4793 (class 2606 OID 42929)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 4801 (class 2606 OID 42998)
-- Name: deal_documents deal_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_documents
    ADD CONSTRAINT deal_documents_pkey PRIMARY KEY (id);


--
-- TOC entry 4797 (class 2606 OID 42962)
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- TOC entry 4799 (class 2606 OID 42980)
-- Name: interactions interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_pkey PRIMARY KEY (id);


--
-- TOC entry 4795 (class 2606 OID 42938)
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- TOC entry 4807 (class 2606 OID 43101)
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- TOC entry 4805 (class 2606 OID 43083)
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- TOC entry 4813 (class 2606 OID 43153)
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- TOC entry 4809 (class 2606 OID 43110)
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- TOC entry 4811 (class 2606 OID 43138)
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- TOC entry 4791 (class 2606 OID 42920)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4789 (class 1259 OID 42921)
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- TOC entry 4823 (class 2606 OID 43022)
-- Name: activities activities_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);


--
-- TOC entry 4824 (class 2606 OID 43017)
-- Name: activities activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- TOC entry 4825 (class 2606 OID 43027)
-- Name: activities activities_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- TOC entry 4821 (class 2606 OID 43004)
-- Name: deal_documents deal_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_documents
    ADD CONSTRAINT deal_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4822 (class 2606 OID 42999)
-- Name: deal_documents deal_documents_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_documents
    ADD CONSTRAINT deal_documents_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);


--
-- TOC entry 4817 (class 2606 OID 42963)
-- Name: deals deals_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- TOC entry 4818 (class 2606 OID 42968)
-- Name: deals deals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- TOC entry 4819 (class 2606 OID 42986)
-- Name: interactions interactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4820 (class 2606 OID 42981)
-- Name: interactions interactions_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interactions
    ADD CONSTRAINT interactions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- TOC entry 4814 (class 2606 OID 42939)
-- Name: leads leads_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- TOC entry 4815 (class 2606 OID 42949)
-- Name: leads leads_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- TOC entry 4816 (class 2606 OID 42944)
-- Name: leads leads_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- TOC entry 4826 (class 2606 OID 43084)
-- Name: projects projects_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);


--
-- TOC entry 4827 (class 2606 OID 43089)
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- TOC entry 4834 (class 2606 OID 43159)
-- Name: purchase_items purchase_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- TOC entry 4835 (class 2606 OID 43154)
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id);


--
-- TOC entry 4828 (class 2606 OID 43121)
-- Name: purchases purchases_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- TOC entry 4829 (class 2606 OID 43111)
-- Name: purchases purchases_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- TOC entry 4830 (class 2606 OID 43116)
-- Name: purchases purchases_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- TOC entry 4831 (class 2606 OID 43126)
-- Name: purchases purchases_source_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchases
    ADD CONSTRAINT purchases_source_purchase_id_fkey FOREIGN KEY (source_purchase_id) REFERENCES public.purchases(id);


--
-- TOC entry 4832 (class 2606 OID 43144)
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- TOC entry 4833 (class 2606 OID 43139)
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


-- Completed on 2026-07-22 19:28:15

--
-- PostgreSQL database dump complete
--

\unrestrict zHCliWKn1jG0cDkHmGoKQ9ILaJTrK5MqzxzatXuEqBmdLnnopXVCKrv2KCO3GOv

