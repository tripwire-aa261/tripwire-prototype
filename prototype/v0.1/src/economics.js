// Unit economics and market sizing. Every input is tagged [memo] or ASSUMPTION;
// the UI lets you edit them all.

export const ECON_INPUTS = [
  // key, label, default, unit, source
  ['sdrUsd', 'Coherent SDR per listener', 2387, '$', 'memo ref [28]: USRP B210 board-only price'],
  ['computeUsd', 'Edge computer per listener', 400, '$', 'ASSUMPTION'],
  ['gnssUsd', 'GNSS timing per listener', 150, '$', 'ASSUMPTION'],
  ['antennaBaseUsd', 'Antennas (0 dBi) per listener', 120, '$', 'ASSUMPTION'],
  ['antennaPerDbiUsd', 'Extra antenna cost per dBi of gain', 25, '$/dBi', 'ASSUMPTION'],
  ['enclosureUsd', 'Enclosure, power, mast per listener', 450, '$', 'ASSUMPTION'],
  ['installUsd', 'Install labor per listener', 800, '$', 'ASSUMPTION'],
  ['listenerPriceUsd', 'Tripwire price per listener', 6500, '$', 'ASSUMPTION'],
  ['subscriptionUsd', 'Subscription per site per year', 11063, '$/yr', 'Derived from memo: $93.98M subscription ceiling ÷ 8,495 facilities'],
  ['serviceCostUsd', 'Our cost to serve per site per year', 3000, '$/yr', 'ASSUMPTION'],
  ['incumbentUsd', 'Incumbent detection package', 104000, '$', 'memo: ~$104,000 per incumbent package'],
  ['radarPanelUsd', 'Licensed radar panel', 40000, '$', 'memo: ~$40k per panel'],
  ['years', 'Deployment / comparison period', 5, 'yr', 'memo: five-year deployment period'],
  ['facilities', 'US facility records', 8495, '', 'memo: market inventory'],
  ['suitabilityPct', 'Sites with usable signals', 50, '%', 'memo ASSUMPTION; the site survey will replace it'],
  ['targetSites', 'Subscribing sites, 2031 target', 400, '', 'memo: ambitious expansion target'],
];

export const ECON_DEFAULTS = Object.fromEntries(ECON_INPUTS.map(([k, , v]) => [k, v]));

export function economics(nListeners, rxGainDbi, e = ECON_DEFAULTS) {
  const bomPerListener =
    e.sdrUsd + e.computeUsd + e.gnssUsd + e.antennaBaseUsd + e.antennaPerDbiUsd * rxGainDbi + e.enclosureUsd;
  const kitCost = bomPerListener * nListeners;
  const installCost = e.installUsd * nListeners;
  const kitPrice = e.listenerPriceUsd * nListeners;
  const hwMarginPct = (100 * (kitPrice - kitCost)) / kitPrice;
  const customerUpfront = kitPrice + installCost; // install passed through at cost
  const customerTotal = customerUpfront + e.subscriptionUsd * e.years;
  const savingsPct = (100 * (e.incumbentUsd - customerTotal)) / e.incumbentUsd;
  const subMarginPct = (100 * (e.subscriptionUsd - e.serviceCostUsd)) / e.subscriptionUsd;
  // Lifetime gross profit per site over the comparison period.
  const siteGrossProfit = kitPrice - kitCost + (e.subscriptionUsd - e.serviceCostUsd) * e.years;
  const samSites = (e.facilities * e.suitabilityPct) / 100;
  return {
    bomPerListener, kitCost, installCost, kitPrice, hwMarginPct, customerUpfront, customerTotal,
    savingsPct, subMarginPct, siteGrossProfit, samSites,
    samArr: samSites * e.subscriptionUsd,
    targetArr: e.targetSites * e.subscriptionUsd,
    memoSamPerYear: (samSites * e.incumbentUsd) / e.years,
  };
}
