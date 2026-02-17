export default async function handler(req, res) {
  return res.status(200).json({ status: 'ok', service: 'Today+ News API', version: '1.0.0' });
}
