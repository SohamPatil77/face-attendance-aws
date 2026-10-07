// Reads EC2 instance details from the Instance Metadata Service (IMDSv2),
// so the app can show which cloud server is serving the request.
let cache = null;
const BASE = 'http://169.254.169.254/latest';

async function imds(pathname, token) {
  const res = await fetch(`${BASE}/meta-data/${pathname}`, {
    headers: { 'X-aws-ec2-metadata-token': token },
    signal: AbortSignal.timeout(800),
  });
  return res.ok ? res.text() : null;
}

export async function getInstanceInfo() {
  if (cache) return cache;
  try {
    const tokenRes = await fetch(`${BASE}/api/token`, {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
      signal: AbortSignal.timeout(800),
    });
    if (!tokenRes.ok) throw new Error('no imds');
    const token = await tokenRes.text();
    const [instanceId, instanceType, az, publicIp] = await Promise.all([
      imds('instance-id', token),
      imds('instance-type', token),
      imds('placement/availability-zone', token),
      imds('public-ipv4', token),
    ]);
    cache = { platform: 'AWS EC2', instanceId, instanceType, availabilityZone: az, publicIp };
  } catch {
    cache = { platform: 'Local machine' };
  }
  return cache;
}
