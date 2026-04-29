export async function POST(req: Request) {
  const body = await req.json();

  try {
    const res = await fetch("http://localhost:8000/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json(
      { success: false, error: "Image server not running. Start it with: cd image-server && python main.py" },
      { status: 503 },
    );
  }
}
