export const dynamic = "force-dynamic";

export async function GET(request) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");

  if (!name) {
    return new Response(JSON.stringify({ error: "Game name is required." }), {
      status: 400,
      headers,
    });
  }

  try {
    const dealsRes = await fetch(
      `https://www.cheapshark.com/api/1.0/games?title=${encodeURIComponent(
        name
      )}&limit=1`
    );
    const games = await dealsRes.json();

    if (!games || games.length === 0) {
      return new Response(JSON.stringify({ error: "Game not found." }), {
        status: 404,
        headers,
      });
    }

    const gameID = games[0].gameID;

    const gameInfoRes = await fetch(
      `https://www.cheapshark.com/api/1.0/games?id=${gameID}`
    );
    const gameInfo = await gameInfoRes.json();

    const deals = gameInfo.deals
      .filter((deal) => deal.price && deal.retailPrice)
      .map((deal) => ({
        storeID: deal.storeID,
        currentPrice: parseFloat(deal.price),
        originalPrice: parseFloat(deal.retailPrice),
        discount: Math.round((1 - deal.price / deal.retailPrice) * 100) + "%",
      }));

    const bestDeals = [];
    const visitedStores = new Set();

    for (const deal of deals) {
      if (!visitedStores.has(deal.storeID)) {
        visitedStores.add(deal.storeID);
        const storeDeals = deals.filter((d) => d.storeID === deal.storeID);
        const best = storeDeals.reduce((lowest, current) =>
          current.currentPrice < lowest.currentPrice ? current : lowest
        );
        bestDeals.push(best);
      }
    }

    const storeMapRes = await fetch(
      "https://www.cheapshark.com/api/1.0/stores"
    );
    const storeMap = await storeMapRes.json();
    const storeName = (id) => {
      const store = storeMap.find((s) => s.storeID === id);
      return store ? store.storeName : `Store ${id}`;
    };

    const offers = bestDeals.map((deal) => ({
      store: storeName(deal.storeID),
      currentPrice: deal.currentPrice,
      originalPrice: deal.originalPrice,
      discount: deal.discount,
    }));

    const cheapest = gameInfo.cheapestPriceEver;
    const cheapestDate = new Date(cheapest.date * 1000)
      .toISOString()
      .split("T")[0];

    const response = {
      title: gameInfo.info.title,
      thumbnail: gameInfo.info.thumb,
      offers,
      lowestHistoricalPrice: {
        price: parseFloat(cheapest.price),
        date: cheapestDate,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch game data." }),
      {
        status: 500,
        headers,
      }
    );
  }
}
