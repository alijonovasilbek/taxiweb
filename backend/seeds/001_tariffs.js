exports.seed = async (knex) => {
  await knex('tariffs').del();
  await knex('tariffs').insert([{
    name: 'Standard',
    base_fare: 5000,
    per_km_price: 1500,
    per_min_price: 200,
    min_fare: 10000,
    night_multiplier: 1.5,
    is_active: true,
  }]);
};
