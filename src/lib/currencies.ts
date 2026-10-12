export const currencies=['NGN','USD','GBP','EUR','GHS','KES','SAR','AED','CAD','AUD'] as const;
export type Currency=typeof currencies[number];
export const currencyNames:Record<Currency,string>={NGN:'Nigerian naira',USD:'US dollar',GBP:'British pound',EUR:'Euro',GHS:'Ghanaian cedi',KES:'Kenyan shilling',SAR:'Saudi riyal',AED:'UAE dirham',CAD:'Canadian dollar',AUD:'Australian dollar'};
