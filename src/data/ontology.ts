// Seed domain: fictional brewery analogy-free ontology — we use a manufacturing /
// supply-chain domain echoing the reference corpus ("Production Line" Vertex view).

export type ObjectType = {
  id: string
  name: string
  icon: string
  color: string
  properties: Property[]
  backing: string
  objectCount: number
  description: string
}
export type Property = { name: string; type: string; indexed: boolean }
export type LinkType = { id: string; from: string; to: string; name: string; cardinality: string }
export type ActionType = { id: string; name: string; objectType: string; params: string[]; requiresAip: boolean }

export const OBJECT_TYPES: ObjectType[] = [
  { id: 'ot-warehouse', name: 'Warehouse', icon: '🏭', color: '#16a34a',
    backing: 'derived/warehouse_dim', objectCount: 3,
    description: 'Physical storage and distribution facility.',
    properties: [
      { name: 'warehouseId', type: 'ValueType/WarehouseId', indexed: true },
      { name: 'name', type: 'String', indexed: true },
      { name: 'capacity', type: 'Integer', indexed: false },
      { name: 'region', type: 'String', indexed: true },
    ] },
  { id: 'ot-raw-material', name: 'Raw Material', icon: '🌾', color: '#22c55e',
    backing: 'derived/raw_materials', objectCount: 15,
    description: 'Grain, hops, adjuncts and yeast inputs.',
    properties: [
      { name: 'materialId', type: 'ValueType/MaterialId', indexed: true },
      { name: 'name', type: 'String', indexed: true },
      { name: 'supplier', type: 'String', indexed: true },
      { name: 'unitCost', type: 'Decimal', indexed: false },
      { name: 'reorderPoint', type: 'Integer', indexed: false },
    ] },
  { id: 'ot-recipe', name: 'Recipe', icon: '📜', color: '#15803d',
    backing: 'derived/recipes', objectCount: 21,
    description: 'Brewing recipes referencing raw materials.',
    properties: [
      { name: 'recipeId', type: 'ValueType/RecipeId', indexed: true },
      { name: 'name', type: 'String', indexed: true },
      { name: 'style', type: 'String', indexed: true },
      { name: 'batchSizeBbl', type: 'Decimal', indexed: false },
    ] },
  { id: 'ot-product', name: 'Product', icon: '🍺', color: '#14532d',
    backing: 'ontology/product', objectCount: 24,
    description: 'Finished SKUs shipped to customers.',
    properties: [
      { name: 'productId', type: 'ValueType/ProductId', indexed: true },
      { name: 'name', type: 'String', indexed: true },
      { name: 'style', type: 'String', indexed: true },
      { name: 'abv', type: 'Decimal', indexed: false },
    ] },
  { id: 'ot-customer', name: 'Customer', icon: '🧑‍💼', color: '#166534',
    backing: 'ontology/customers', objectCount: 30,
    description: 'Accounts purchasing finished product.',
    properties: [
      { name: 'customerId', type: 'ValueType/CustomerId', indexed: true },
      { name: 'name', type: 'String', indexed: true },
      { name: 'segment', type: 'String', indexed: true },
      { name: 'lifetimeValue', type: 'Decimal', indexed: false },
    ] },
  { id: 'ot-batch', name: 'Production Batch', icon: '🧪', color: '#4ade80',
    backing: 'derived/production_batches', objectCount: 1842,
    description: 'A single brewed batch of a recipe.',
    properties: [
      { name: 'batchId', type: 'ValueType/BatchId', indexed: true },
      { name: 'brewDate', type: 'Timestamp', indexed: true },
      { name: 'recipeId', type: 'ValueType/RecipeId', indexed: true },
      { name: 'yieldBbl', type: 'Decimal', indexed: false },
    ] },
]

export const LINK_TYPES: LinkType[] = [
  { id: 'lt-1', from: 'ot-warehouse', to: 'ot-raw-material', name: 'Stores', cardinality: '1 → N' },
  { id: 'lt-2', from: 'ot-recipe', to: 'ot-raw-material', name: 'Requires', cardinality: 'N ↔ N' },
  { id: 'lt-3', from: 'ot-recipe', to: 'ot-product', name: 'Produces', cardinality: '1 → N' },
  { id: 'lt-4', from: 'ot-batch', to: 'ot-recipe', name: 'Brews', cardinality: 'N → 1' },
  { id: 'lt-5', from: 'ot-batch', to: 'ot-raw-material', name: 'Consumes', cardinality: 'N ↔ N' },
  { id: 'lt-6', from: 'ot-customer', to: 'ot-product', name: 'Demands', cardinality: 'N ↔ N' },
]

export const ACTION_TYPES: ActionType[] = [
  { id: 'at-1', name: 'Flag Reorder', objectType: 'ot-raw-material', params: ['materialId', 'qty'], requiresAip: false },
  { id: 'at-2', name: 'Approve Batch Release', objectType: 'ot-batch', params: ['batchId', 'qaNotes'], requiresAip: true },
  { id: 'at-3', name: 'Reassign Customer Segment', objectType: 'ot-customer', params: ['customerId', 'segment'], requiresAip: false },
]

export const DATASETS = [
  { name: 'Raw Dataset 1', layer: 'raw', path: 'source_a / table_1' },
  { name: 'Raw Dataset 2', layer: 'raw', path: 'source_a / table_2' },
  { name: 'Clean Dataset 1', layer: 'clean', path: 'project: datasource-a' },
  { name: 'Clean Dataset 2', layer: 'clean', path: 'project: transform-a+b' },
  { name: 'Clean Dataset 2 (B)', layer: 'clean', path: 'project: datasource-b' },
  { name: 'Derived Dataset', layer: 'derived', path: 'project: transform-a+b' },
  { name: 'Ontology Dataset: Product', layer: 'ontology', path: 'project: ontology-product' },
] as const
