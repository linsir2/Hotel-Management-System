package com.hotel.ai.filter;

import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpServletResponseWrapper;
import java.io.*;

/**
 * Response wrapper that captures the response body as a String.
 * Used by AiGatewayFilter for PII masking + audit logging.
 */
public class CharResponseWrapper extends HttpServletResponseWrapper {

    private final ByteArrayOutputStream byteStream = new ByteArrayOutputStream();
    private ServletOutputStream outputStream;
    private PrintWriter writer;

    public CharResponseWrapper(HttpServletResponse response) {
        super(response);
    }

    @Override
    public ServletOutputStream getOutputStream() {
        if (outputStream == null) {
            outputStream = new DelegatingServletOutputStream(byteStream);
        }
        return outputStream;
    }

    @Override
    public PrintWriter getWriter() {
        if (writer == null) {
            writer = new PrintWriter(new OutputStreamWriter(byteStream));
        }
        return writer;
    }

    @Override
    public void flushBuffer() throws IOException {
        if (writer != null) writer.flush();
        if (outputStream != null) outputStream.flush();
    }

    @Override
    public String toString() {
        try {
            flushBuffer();
            return byteStream.toString("UTF-8");
        } catch (IOException e) {
            return "";
        }
    }

    // --- inner delegating stream ---
    private static class DelegatingServletOutputStream extends ServletOutputStream {
        private final OutputStream target;
        DelegatingServletOutputStream(OutputStream target) { this.target = target; }
        @Override public void write(int b) throws IOException { target.write(b); }
        @Override public boolean isReady() { return true; }
        @Override public void setWriteListener(javax.servlet.WriteListener listener) {}
    }
}
