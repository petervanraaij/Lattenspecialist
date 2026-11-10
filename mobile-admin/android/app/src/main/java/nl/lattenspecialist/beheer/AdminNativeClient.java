package nl.lattenspecialist.beheer;

import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.io.ByteArrayOutputStream;

/** Fixed first-party backend only. Never follows redirects carrying the owner credential. */
final class AdminNativeClient {
    static final class HttpError extends Exception {
        final int status;
        HttpError(int status) { super("HTTP " + status); this.status=status; }
    }
    static String call(String path, String token, String body) throws Exception {
        if (!path.startsWith("/api/admin/")) throw new IllegalArgumentException("Invalid native route");
        HttpURLConnection connection=(HttpURLConnection)new URL("https://stuiterbaas-reserveren.stuiterbaas-456655a6.workers.dev"+path).openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(10000);connection.setReadTimeout(10000);
            connection.setRequestProperty("Authorization","Bearer "+token);
            if(!"/api/admin/reservations".equals(path))connection.setRequestProperty("Origin","https://localhost");
            connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("Accept-Encoding","identity");
            connection.setUseCaches(false);
            if(body!=null){
                connection.setRequestMethod("POST");connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
                byte[] bytes=body.getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);
                try(java.io.OutputStream stream=connection.getOutputStream()){stream.write(bytes);}
            }
            int status=connection.getResponseCode();if(status!=200)throw new HttpError(status);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(java.io.InputStream stream=connection.getInputStream()){
                byte[] buffer=new byte[8192];int length;
                while((length=stream.read(buffer))!=-1){if(bytes.size()+length>4000000)throw new IllegalStateException("Response too large");bytes.write(buffer,0,length);}
            }
            return bytes.toString("UTF-8");
        }finally{connection.disconnect();}
    }
}
