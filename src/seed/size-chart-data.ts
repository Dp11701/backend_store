/** Bảng size Thiên Nga — đồng bộ với storefront SIZE_TABLE cũ */

function parseHeightRange(range: string): { heightMin: number; heightMax: number } {
  const parts = range.split(/[–-]/).map((s) => parseInt(s.trim(), 10));
  return {
    heightMin: parts[0] ?? 0,
    heightMax: parts[1] ?? parts[0] ?? 0,
  };
}

function rowsFromTable(
  table: readonly (readonly [string, string, string, string, string])[],
) {
  return table.map(([size, bust, waist, hip, height]) => {
    const { heightMin, heightMax } = parseHeightRange(height);
    return {
      size,
      bust: Number(bust),
      waist: Number(waist),
      hip: Number(hip),
      heightMin,
      heightMax,
    };
  });
}

const WOMENS_DRESS_TABLE = [
  ['XS', '80', '62', '86', '155–162'],
  ['S', '84', '66', '90', '158–165'],
  ['M', '88', '70', '94', '162–168'],
  ['L', '92', '74', '98', '165–172'],
  ['XL', '96', '78', '102', '168–175'],
] as const;

const WOMENS_TOP_TABLE = [
  ['XS', '78', '60', '84', '155–162'],
  ['S', '82', '64', '88', '158–165'],
  ['M', '86', '68', '92', '162–168'],
  ['L', '90', '72', '96', '165–172'],
  ['XL', '94', '76', '100', '168–175'],
] as const;

const VEST_TABLE = [
  ['XS', '82', '64', '88', '158–165'],
  ['S', '86', '68', '92', '162–168'],
  ['M', '90', '72', '96', '165–172'],
  ['L', '94', '76', '100', '168–175'],
  ['XL', '98', '80', '104', '170–178'],
] as const;

const CHART_DESCRIPTION =
  'Đo cơ thể tại vị trí lớn nhất của ngực, eo, hông (đơn vị: cm). Chiều cao tính theo khoảng cm.';

export const SEED_SIZE_CHARTS = [
  {
    sizeChartId: 'sc-default',
    slug: 'thien-nga-mac-dinh',
    name: 'Bảng size Thiên Nga (mặc định)',
    description: CHART_DESCRIPTION,
    rows: rowsFromTable(WOMENS_DRESS_TABLE),
    isDefault: true,
  },
  {
    sizeChartId: 'sc-dam-cong-so',
    slug: 'dam-cong-so',
    name: 'Bảng size — Đầm công sở',
    categorySlug: 'dam-cong-so',
    description: CHART_DESCRIPTION,
    rows: rowsFromTable(WOMENS_DRESS_TABLE),
    isDefault: false,
  },
  {
    sizeChartId: 'sc-ao-cong-so',
    slug: 'ao-cong-so',
    name: 'Bảng size — Áo công sở',
    categorySlug: 'ao-cong-so',
    description: CHART_DESCRIPTION,
    rows: rowsFromTable(WOMENS_TOP_TABLE),
    isDefault: false,
  },
  {
    sizeChartId: 'sc-vest',
    slug: 'vest',
    name: 'Bảng size — Vest',
    categorySlug: 'vest',
    description: CHART_DESCRIPTION,
    rows: rowsFromTable(VEST_TABLE),
    isDefault: false,
  },
];

/** Map categorySlug → sizeChartId khi seed sản phẩm */
export const CATEGORY_SIZE_CHART_ID: Record<string, string> = {
  'dam-cong-so': 'sc-dam-cong-so',
  'ao-cong-so': 'sc-ao-cong-so',
  vest: 'sc-vest',
};

export function sizeChartIdForCategory(categorySlug?: string): string {
  if (!categorySlug) return 'sc-default';
  return CATEGORY_SIZE_CHART_ID[categorySlug] ?? 'sc-default';
}
