package com.saarthix.crm.service;

import com.saarthix.crm.domain.Catalog;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Reads a leads spreadsheet exported as CSV. Column order does not matter; the header names do. */
@Component
public class CsvImporter {
    private static final Map<String, String> ALIASES = Map.ofEntries(
            Map.entry("name", "name"), Map.entry("lead", "name"), Map.entry("contact", "name"),
            Map.entry("full name", "name"), Map.entry("contact name", "name"),
            Map.entry("company", "company"), Map.entry("account", "company"), Map.entry("organisation", "company"),
            Map.entry("organization", "company"),
            Map.entry("email", "email"), Map.entry("email address", "email"),
            Map.entry("phone", "phone"), Map.entry("mobile", "phone"), Map.entry("phone number", "phone"),
            Map.entry("value", "value"), Map.entry("deal value", "value"), Map.entry("amount", "value"),
            Map.entry("deal value (usd)", "value"),
            Map.entry("stage", "stage"), Map.entry("status", "stage"),
            Map.entry("priority", "priority"),
            Map.entry("source", "source"), Map.entry("lead source", "source"),
            Map.entry("notes", "notes"), Map.entry("note", "notes"), Map.entry("comments", "notes"));

    public Result parse(String csv) {
        List<String[]> rows = split(csv);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That file looks empty");
        }
        Map<String, Integer> columns = new HashMap<>();
        String[] header = rows.get(0);
        for (int i = 0; i < header.length; i++) {
            String key = ALIASES.get(header[i].trim().toLowerCase(Locale.ROOT));
            if (key != null) columns.putIfAbsent(key, i);
        }
        if (!columns.containsKey("name")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The file needs a Name column. Accepted headers: Name, Company, Email, Phone, Value, Stage, Priority, Source, Notes.");
        }

        List<Row> parsed = new ArrayList<>();
        List<String> problems = new ArrayList<>();
        for (int i = 1; i < rows.size(); i++) {
            String[] cells = rows.get(i);
            int line = i + 1;
            String name = cell(cells, columns.get("name"));
            if (name.isBlank()) {
                continue;
            }
            long value = 0;
            String rawValue = cell(cells, columns.get("value"));
            if (!rawValue.isBlank()) {
                try {
                    value = Math.round(Double.parseDouble(rawValue.replaceAll("[^0-9.\\-]", "")));
                } catch (Exception ex) {
                    problems.add("Row " + line + ": could not read the value \"" + rawValue + "\", used 0");
                }
            }
            if (value < 0) value = 0;
            String stage = match(cell(cells, columns.get("stage")), Catalog.STAGES, "New", line, "stage", problems);
            String priority = match(cell(cells, columns.get("priority")), Catalog.PRIORITIES, "Medium", line, "priority", problems);
            String source = match(cell(cells, columns.get("source")), Catalog.SOURCES, "Other", line, "source", problems);
            parsed.add(new Row(line, name, cell(cells, columns.get("company")), cell(cells, columns.get("email")),
                    cell(cells, columns.get("phone")), value, stage, priority, source, cell(cells, columns.get("notes"))));
        }
        if (parsed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No rows with a name were found in that file");
        }
        return new Result(parsed, problems);
    }

    private String match(String raw, List<String> allowed, String fallback, int line, String label, List<String> problems) {
        if (raw == null || raw.isBlank()) return fallback;
        for (String option : allowed) {
            if (option.equalsIgnoreCase(raw.trim())) return option;
        }
        problems.add("Row " + line + ": unknown " + label + " \"" + raw.trim() + "\", used " + fallback);
        return fallback;
    }

    private String cell(String[] cells, Integer index) {
        if (index == null || index >= cells.length || cells[index] == null) return "";
        return cells[index].trim();
    }

    private List<String[]> split(String csv) {
        List<String[]> rows = new ArrayList<>();
        List<String> current = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean quoted = false;
        String text = csv.replace("\r\n", "\n").replace('\r', '\n');
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (quoted) {
                if (c == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
                        field.append('"');
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field.append(c);
                }
            } else if (c == '"') {
                quoted = true;
            } else if (c == ',') {
                current.add(field.toString());
                field.setLength(0);
            } else if (c == '\n') {
                current.add(field.toString());
                field.setLength(0);
                if (current.stream().anyMatch(value -> !value.isBlank())) {
                    rows.add(current.toArray(String[]::new));
                }
                current = new ArrayList<>();
            } else {
                field.append(c);
            }
        }
        current.add(field.toString());
        if (current.stream().anyMatch(value -> !value.isBlank())) {
            rows.add(current.toArray(String[]::new));
        }
        return rows;
    }

    public record Row(int line, String name, String company, String email, String phone, long value,
                      String stage, String priority, String source, String notes) {
    }

    public record Result(List<Row> rows, List<String> problems) {
    }
}
