# 本機靜態伺服器（多執行緒）：專案根目錄 → http://localhost:8080/
# 用法：powershell -ExecutionPolicy Bypass -File demo\serve.ps1
param([int]$Port = 8080)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here

Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Generic;

public static class MiniServer {
    public static string Root;
    static readonly Dictionary<string,string> Mime = new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase){
        {".html","text/html; charset=utf-8"},{".js","text/javascript; charset=utf-8"},
        {".css","text/css; charset=utf-8"},{".json","application/json; charset=utf-8"},
        {".png","image/png"},{".jpg","image/jpeg"},{".jpeg","image/jpeg"},{".webp","image/webp"},
        {".glb","model/gltf-binary"},{".gltf","model/gltf+json"},{".bin","application/octet-stream"},
        {".ktx2","image/ktx2"},{".ico","image/x-icon"},{".svg","image/svg+xml"},
        {".md","text/plain; charset=utf-8"}
    };
    public static void Run(string prefix){
        var l = new HttpListener();
        l.Prefixes.Add(prefix);
        l.Start();
        while(true){
            var ctx = l.GetContext();
            Task.Run(() => Handle(ctx));
        }
    }
    static void Handle(HttpListenerContext ctx){
        try {
            var rel = Uri.UnescapeDataString(ctx.Request.Url.LocalPath).TrimStart('/');
            if (rel.Length == 0) rel = "demo/island3d.html";
            var safeRoot = Path.GetFullPath(Root);
            var full = Path.GetFullPath(Path.Combine(safeRoot, rel.Replace('/', Path.DirectorySeparatorChar)));
            if (!full.StartsWith(safeRoot, StringComparison.OrdinalIgnoreCase)) {
                ctx.Response.StatusCode = 403;
            } else if (File.Exists(full)) {
                var bytes = File.ReadAllBytes(full);
                var ext = Path.GetExtension(full);
                string ct;
                if (!Mime.TryGetValue(ext, out ct)) ct = "application/octet-stream";
                ctx.Response.ContentType = ct;
                ctx.Response.Headers.Add("Cache-Control", "no-store");
                ctx.Response.ContentLength64 = bytes.Length;
                ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
            } else {
                ctx.Response.StatusCode = 404;
                var msg = Encoding.UTF8.GetBytes("404 " + rel);
                ctx.Response.OutputStream.Write(msg, 0, msg.Length);
            }
        } catch {
            try { ctx.Response.StatusCode = 500; } catch {}
        } finally {
            try { ctx.Response.Close(); } catch {}
        }
    }
}
"@

[MiniServer]::Root = $root
Write-Host "Serving $root"
Write-Host "http://localhost:$Port/demo/island3d.html"
[MiniServer]::Run("http://localhost:$Port/")
