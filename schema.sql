-- Óptica Lumen · esquema para Supabase (PostgreSQL)
-- Ejecutar en: Supabase > SQL Editor > New query

create table if not exists productos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  marca       text not null,
  categoria   text not null check (categoria in ('graduacion','sol','contacto')),
  descripcion text,
  precio      numeric(10,2) not null check (precio >= 0),
  stock       integer not null default 0 check (stock >= 0),
  color       text default '#12263A',      -- color del marco (hex)
  imagen_url  text,                        -- opcional: foto real del producto
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists pedidos (
  id             uuid primary key,
  cliente_nombre text not null,
  telefono       text not null,
  email          text,
  total          numeric(10,2) not null check (total >= 0),
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente','confirmado','listo','entregado','cancelado')),
  creado_en      timestamptz not null default now()
);

create table if not exists pedido_items (
  id              bigint generated always as identity primary key,
  pedido_id       uuid not null references pedidos(id) on delete cascade,
  producto_id     uuid not null references productos(id),
  cantidad        integer not null check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0)
);

-- Seguridad (RLS): el público solo ve productos activos y puede crear pedidos.
-- Los pedidos solo los lees tú desde el panel de Supabase.
alter table productos    enable row level security;
alter table pedidos      enable row level security;
alter table pedido_items enable row level security;

create policy "ver productos activos" on productos
  for select to anon using (activo = true);
create policy "crear pedidos" on pedidos
  for insert to anon with check (estado = 'pendiente');
create policy "crear items de pedido" on pedido_items
  for insert to anon with check (true);

-- Datos de ejemplo
insert into productos (nombre, marca, categoria, descripcion, precio, stock, color) values
 ('Aro Redondo Fino',  'Lumen',    'graduacion', 'Metal liviano, ideal para uso diario.',            89.00, 12, '#12263A'),
 ('Acetato Carey',     'Lumen',    'graduacion', 'Acetato color carey con puentes ajustables.',     119.00,  8, '#9A5B1E'),
 ('Rectangular Negro', 'Nordik',   'graduacion', 'Marco ancho para pantallas y oficina.',            99.00, 15, '#1B1B1B'),
 ('Aviador Clásico',   'Solaris',  'sol',        'Lentes polarizados con protección UV400.',        135.00, 10, '#0E7C86'),
 ('Cat-Eye Sol',       'Solaris',  'sol',        'Marco ligero, lentes con filtro UV400.',          125.00,  6, '#B23A48'),
 ('Lentes de contacto mensuales', 'ClearView', 'contacto', 'Caja de 6 unidades, hidratación prolongada.', 42.00, 40, '#0E7C86');