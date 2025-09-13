require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const yahooFinance = require('yahoo-finance2').default;

// Init Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function getActiveTickers() {
  const { data, error } = await supabase
    .from('tickers')
    .select('id, symbol, api_symbol')
    .eq('active', true);

  if (error) throw error;
  return data;
}

async function fetchQuote(symbol) {
    try {
      const result = await yahooFinance.quote(symbol);
      const timestamp = result.regularMarketTime
        ? new Date(result.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(); // fallback naar nu()
      return {
        value: result.regularMarketPrice,
        quote_time: timestamp,
        metadata: {
          change: result.regularMarketChange,
          change_pct: result.regularMarketChangePercent
        }
      };
    } catch (e) {
      console.error(`Error fetching quote for ${symbol}:`, e);
      return null;
    }
  }

async function upsertQuote(ticker, quote) {
  if (!quote) return;
  await supabase.from('ticker_quotes').insert({
    ticker_id: ticker.id,
    quote_time: quote.quote_time,
    value: quote.value,
    metadata: quote.metadata
  });
  await supabase
    .from('tickers')
    .update({ last_quote_time: quote.quote_time })
    .eq('id', ticker.id);
}

async function main() {
  const tickers = await getActiveTickers();
  for (const ticker of tickers) {
    const symbol = ticker.api_symbol || ticker.symbol;
    const quote = await fetchQuote(symbol);
    await upsertQuote(ticker, quote);
    console.log(`Updated ${symbol}: $${quote?.value} @ ${quote?.quote_time}`);
  }
  console.log('All tickers updated.');
}

main();
