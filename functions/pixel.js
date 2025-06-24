export default {
  async fetch(request, env, ctx) {
    const headers = {
      "Content-Type": "application/javascript",
      "Access-Control-Allow-Origin": "*"
    };

    try {
      const url = new URL(request.url);
      const cid = url.pathname.split("/").pop() || "default-campaign";

      const base64 = `
KGZ1bmN0aW9uKCl7dHJ5e2NvbnN0IGNpZD0i${btoa(cid)}Ijtk
b21haW49bG9jYXRpb24uaG9zdG5hbWU7Y29uc3QgY29tcGV0aXRvcnM9WyJvcmRvemVu
LmNvbSIsImZsb2F0Ym9vbGVhbi5jb20iLCJzbWN0LmNvIiwic21jdC5pbyJdO2Z1bmN0
aW9uIGcoaSl7cmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudCgoZG9jdW1lbnQuY29va2ll
fHwiIikuc3BsaXQoJzsnKS5maW5kKHI9PntyLnN0YXJ0c1dpdGgoaSs9Jz0nKT0+cn0p
LnNwbGl0KCc9JylbMV18fCcnfWZ1bmN0aW9uIHMoa3YsdixkKXtsZXQgZT1uZXcgRGF0
ZSgpO2Uuc2V0VGltZShlLmdldFRpbWUoKSsyZDg2ZTApO2RvY3VtZW50LmNvb2tpZT1r
dis9ZW5jb2RlVVJJQ29tcG9uZW50KHYpKyI7IHBhdGg9LzsgbWF4LWFnZT0iK2Q4NjQw
KyI7IFNhbWVTaXRlPUxheCJ9bGV0IF9yPWxvY2FsU3RvcmFnZS5nZXRJdGVtKCdfcicp
fHxnKF8nX3InKTtpZighX3Ipe19yPWNyeXB0by5yYW5kb21VVUlEKCk7bG9jYWxTdG9y
YWdlLnNldEl0ZW0oJ19yJyxfcik7cygnX3InLF9yLDMwKX1lbHNle2xvY2FsU3RvcmFn
ZS5zZXRJdGVtKCdfcicsX3IpO3MoJ19yJyxfcik7fWRvY3VtZW50LmNvb2tpZT0idXNl
cl9pZF90PSIrX3IrIjsgcGF0aD0vOyBtYXgtYWdlPTMxNTM2MDAwOyBTYW1lU2l0ZT1M
YXgiO2RvY3VtZW50LmNvb2tpZT0ic21jX3VpZD0iK19yKyI7IHBhdGg9LzsgbWF4LWFn
ZT0zMTUzNjAwMDsgU2FtZVNpdGU9TGF4Ijtjb25zdCBvbmNlPXNlc3Npb25TdG9yYWdl
LmdldEl0ZW0oJ2lfJytjaWQpO2NvbnN0IGQ9e2NpZCx1OmxvY2F0aW9uLmhyZWYscipk
b2N1bWVudC5yZWZlcnJlcnx8bnVsbCx1YTpuYXZpZ2F0b3IudXNlckFnZW50LGR0Oi9N
b2JpfEFuZHJvaWQuaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpPyJNIjoiRCIsYjoo
KT0+e3JldHVybiB1LmluY2x1ZGVzKCJDaHJvbWUiKT8iQyI6dS5pbmNsdWRlcygiRmly
ZWZveCIpPyJGIjp1LmluY2x1ZGVzKCJTYWZhcmlvIik/IlMiOiJVIn0pKCksb3M6bmF2
aWdhdG9yLnBsYXRmb3JtLHN yOnNjcmVlbi53aWR0aCsi eCIrc2NyZWVuLmhlaWdodCxj
bTp7X3J9LGRvbWFpbn07ZmV0Y2goImh0dHBzOi8vcmV0YXJnbG93LmNvbS9sb2ciLHtt
ZXRob2Q6IlBPU1QiLGhlYWRlcnM6eyJDb250ZW50LVR5cGUiOiJhcHBsaWNhdGlvbi9q
c29uIn0sYm9keTpKU09OLnN0cmluZ2lmeShkKX0pO2ZldGNoKCJodHRwczovL3JldGFy
Z2xvdy5jb20vc2VydmUiLHttZXRob2Q6IlBPU1QiLGhlYWRlcnM6eyJDb250ZW50LVR5
cGUiOiJhcHBsaWNhdGlvbi9qc29uIn0sYm9keTpKU09OLnN0cmluZ2lmeSh7dTp3aW5k
b3cubG9jYXRpb24uaHJlZixjbTpkLmNtfSl9KS50aGVuKHI9PntyLmpzb24oKX0pLnRo
ZW4oai0+e2lmKGouYWRfdXJsJiYh b25jZSl7Y29uc3QgZj1kb2N1bWVudC5jcmVhdGVF
bGVtZW50KCdpZnJhbWUnKTtmLnN0eWxlLmRpc3BsYXk9J25vbmUnOyBmLnNyYz1qLmFk
X3VybC5yZXBsYWNlKCIje3J9Iixfcilkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGYp
O3Nlc3Npb25TdG9yYWdlLnNldEl0ZW0oJ2lfJytjaWQsJzEnKTt9fSl9Y2F0Y2goZSl7
fX0pKCk=`;

      const decoded = atob(base64.replace(/\s+/g, ''));
      return new Response(decoded, { status: 200, headers });
    } catch (err) {
      return new Response(`console.error("Retarglow Pixel Error:", ${JSON.stringify(err.message)});`, {
        status: 500,
        headers
      });
    }
  }
};
