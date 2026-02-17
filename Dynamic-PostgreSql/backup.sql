--
-- PostgreSQL database dump
--

\restrict bq0CTuqF5atliaiKZ6UhwR8lvIz96tUgCIwYygcT7uJiP1TXwTHQwEsQ1Ggmsnn

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(20),
    region character varying(50),
    zone character varying(50)
);


--
-- Name: customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_id_seq OWNED BY public.customers.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    product_id integer NOT NULL,
    category_id integer NOT NULL,
    invoice_date date NOT NULL,
    quantity integer NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    CONSTRAINT invoices_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT invoices_total_amount_check CHECK ((total_amount >= (0)::numeric))
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    price numeric(10,2) NOT NULL,
    category_id integer NOT NULL,
    CONSTRAINT products_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: query_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_configs (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    filters jsonb,
    aggregation jsonb,
    "having" jsonb,
    group_by jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: query_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.query_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: query_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.query_configs_id_seq OWNED BY public.query_configs.id;


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN id SET DEFAULT nextval('public.customers_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: query_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_configs ALTER COLUMN id SET DEFAULT nextval('public.query_configs_id_seq'::regclass);


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name) FROM stdin;
27	Electronics
28	Home & Garden
29	Sports
30	Clothing
31	Books
32	Bakery
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.customers (id, name, email, phone, region, zone) FROM stdin;
16	Sahil Theurkar	sahil@gmail.com	+91-8975676542	West	Pune
17	Saurabh Patil	saurabh@gmail.com	+91-8976565564	East	Mumbai
18	Sayali Kolte	sayali@gmail.com	+91-7689564532	West	Pune
19	Sunita Patil	sunita@gmail.com	+91-9987654032	East	Mumbai
20	Rohit Shelke	rohit@gmail.com	+91-7798342156	North	Banglore
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, customer_id, product_id, category_id, invoice_date, quantity, total_amount) FROM stdin;
7	16	82	28	2024-02-10	1	10.00
10	16	86	27	2025-04-09	10	10.00
12	16	89	31	2025-09-01	3	10.00
14	16	81	32	2025-05-24	10	10.00
5	19	86	27	2024-01-20	3	999.97
6	20	84	29	2024-02-15	1	45.99
8	20	89	31	2024-02-20	1	79.99
9	20	83	31	2026-01-08	6	299.94
11	17	82	28	2025-04-13	1	149.99
13	20	89	31	2025-04-05	5	554.95
15	17	82	28	2025-08-13	4	599.96
17	19	85	27	2025-06-20	4	1199.96
19	19	89	31	2025-05-04	2	221.98
20	18	84	29	2025-10-01	7	279.93
21	18	86	27	2025-12-16	8	7999.92
22	20	90	32	2026-01-06	4	359.96
23	20	90	32	2025-10-27	5	449.95
24	18	85	27	2025-10-15	3	899.97
25	19	82	28	2025-11-22	1	149.99
26	19	90	32	2025-03-01	2	179.98
28	17	89	31	2025-03-14	6	665.94
16	16	88	30	2025-08-15	1	10.00
18	16	86	27	2025-06-13	5	10.00
27	16	88	30	2025-05-12	5	10.00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, price, category_id) FROM stdin;
81	Bread	3.99	32
82	Garden Tools Set	149.99	28
83	JavaScript Guide	49.99	31
84	Basketball	39.99	29
85	SmartPhone	299.99	27
86	Laptop	999.99	27
87	Suit	169.99	30
88	Blazer	209.99	30
89	Bhagvad Gita	110.99	31
90	Cake	89.99	32
\.


--
-- Data for Name: query_configs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.query_configs (id, name, description, filters, aggregation, "having", group_by, created_at, updated_at) FROM stdin;
5	Bread Or Book		[{"field": "name", "logic": "AND", "value": "Bread", "operator": "eq", "collection": "products"}, {"field": "name", "logic": "OR", "value": "JavaScript Guide", "operator": "eq", "collection": "products"}]	[]	[]	[]	2026-02-09 18:30:28.071136	2026-02-09 18:30:28.071136
6	OR with Agg		[{"field": "name", "logic": "AND", "value": "Bread", "operator": "eq", "collection": "products"}, {"field": "total_amount", "logic": "OR", "value": "JavaScript Guide", "operator": "eq", "collection": "invoices"}]	[{"alias": "sum_total_amount", "field": "total_amount", "operator": "sum", "collection": "invoices"}]	[]	[{"field": "total_amount", "collection": "invoices"}]	2026-02-09 18:44:23.580557	2026-02-09 18:44:23.580557
7	Electroncs/Sports		[{"field": "name", "logic": "AND", "value": "Electronics", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "AND", "value": "Sports", "operator": "eq", "collection": "categories"}]	[{"alias": "sum_total_amount", "field": "total_amount", "operator": "sum", "collection": "invoices"}]	[]	[{"field": "total_amount", "collection": "invoices"}]	2026-02-10 11:48:02.951713	2026-02-10 11:48:02.951713
9	eleorsportsand laptop		[{"field": "name", "logic": "AND", "value": "Electronics", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "OR", "value": "Sports", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "AND", "value": "Laptop", "operator": "eq", "collection": "products"}]	[]	[]	[]	2026-02-10 14:40:50.918314	2026-02-10 14:40:50.918314
10	basketball		[{"field": "name", "logic": "AND", "value": "Electronics", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "OR", "value": "Sports", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "AND", "value": "Basketball", "operator": "eq", "collection": "products"}]	[{"alias": "sum_total_amount", "field": "total_amount", "operator": "sum", "collection": "invoices"}]	[]	[{"field": "total_amount", "collection": "invoices"}]	2026-02-10 14:42:31.126035	2026-02-10 14:42:31.126035
11	try having		[{"field": "name", "logic": "AND", "value": "Electronics", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "OR", "value": "Sports", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "AND", "value": "Basketball", "operator": "eq", "collection": "products"}, {"field": "quantity", "logic": "AND", "value": "5", "operator": "gt", "collection": "invoices"}]	[{"alias": "sum_total_amount", "field": "total_amount", "operator": "sum", "collection": "invoices"}]	[]	[{"field": "total_amount", "collection": "invoices"}]	2026-02-10 14:54:51.315612	2026-02-10 14:54:51.315612
12	Having condition		[{"field": "name", "logic": "AND", "value": "Electronics", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "AND", "value": "Sports", "operator": "eq", "collection": "categories"}, {"field": "name", "logic": "OR", "value": "Basketball", "operator": "eq", "collection": "products"}, {"field": "quantity", "logic": "AND", "value": "5", "operator": "gt", "collection": "invoices"}]	[{"alias": "sum_total_amount", "field": "total_amount", "operator": "sum", "collection": "invoices"}]	[{"field": "sum_total_amount", "value": "1000", "operator": "gt"}]	[{"field": "customer_id", "collection": "invoices"}]	2026-02-10 15:24:09.605384	2026-02-10 15:24:09.605384
\.


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 32, true);


--
-- Name: customers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customers_id_seq', 20, true);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.invoices_id_seq', 108, true);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.products_id_seq', 90, true);


--
-- Name: query_configs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.query_configs_id_seq', 12, true);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: customers customers_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_email_key UNIQUE (email);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: query_configs query_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_configs
    ADD CONSTRAINT query_configs_pkey PRIMARY KEY (id);


--
-- Name: invoices fk_invoice_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoice_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: invoices fk_invoice_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoice_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: invoices fk_invoice_product; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoice_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: products fk_products_category; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict bq0CTuqF5atliaiKZ6UhwR8lvIz96tUgCIwYygcT7uJiP1TXwTHQwEsQ1Ggmsnn

