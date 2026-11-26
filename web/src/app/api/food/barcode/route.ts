/** Previous clients must use the name-based product search. */
export function GET() {
  return Response.json({ error: 'Consulta los productos por nombre.' }, { status: 410 });
}
