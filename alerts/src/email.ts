import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface DropAlert {
  title: string;
  url: string;
  location: string;
  old_price: number;
  new_price: number;
  drop_pct: number;
}

export async function sendDropEmail(to: string, drops: DropAlert[]) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL SKIP] No API key, would send ${drops.length} drops to ${to}`);
    return;
  }

  const rows = drops
    .map(
      (d) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #333">${d.title}</td>
          <td style="padding:8px;border-bottom:1px solid #333">${d.location}</td>
          <td style="padding:8px;border-bottom:1px solid #333;text-decoration:line-through;color:#999">${d.old_price.toLocaleString("cs-CZ")} Kč</td>
          <td style="padding:8px;border-bottom:1px solid #333;font-weight:bold">${d.new_price.toLocaleString("cs-CZ")} Kč</td>
          <td style="padding:8px;border-bottom:1px solid #333;color:#ef4444;font-weight:bold">-${d.drop_pct.toFixed(1)}%</td>
          <td style="padding:8px;border-bottom:1px solid #333"><a href="${d.url}" style="color:#3b82f6">Detail</a></td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: "Cenolov <alerts@cenolov.cz>",
    to,
    subject: `${drops.length} nových cenových pádů!`,
    html: `
      <div style="background:#000;color:#fff;padding:20px;font-family:sans-serif">
        <h1 style="color:#ef4444">Cenolov Alert</h1>
        <p>${drops.length} nemovitostí snížilo cenu:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="color:#999;text-align:left">
              <th style="padding:8px">Nemovitost</th>
              <th style="padding:8px">Lokalita</th>
              <th style="padding:8px">Původní</th>
              <th style="padding:8px">Nová</th>
              <th style="padding:8px">Pokles</th>
              <th style="padding:8px"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
  });

  console.log(`Email sent to ${to} with ${drops.length} drops`);
}
