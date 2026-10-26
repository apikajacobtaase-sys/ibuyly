CREATE TABLE IF NOT EXISTS public.wishlists (
    id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT wishlists_pkey PRIMARY KEY (id),

    CONSTRAINT wishlists_user_id_product_id_key
        UNIQUE (user_id, product_id),

    CONSTRAINT wishlists_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT wishlists_product_id_fkey
        FOREIGN KEY (product_id)
        REFERENCES public.products(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS wishlists_product_id_idx
    ON public.wishlists(product_id);