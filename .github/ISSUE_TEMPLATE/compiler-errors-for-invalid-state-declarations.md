# Compiler errors for invalid state declarations and usage

## Description
Add compiler enforcement for the following invalid scenarios:
- Use of undeclared state variables: `{{ unknown }}`.
- Use of expressions in placeholders: `{{ count + 1 }}`.
- Invalid state initialization: `state count = count + 1;`.
- State mutations outside allowed event handlers.

## Acceptance Criteria

1. Compiler throws errors for undeclared state usage in placeholders.
2. Compiler disallows expressions within placeholders.
3. Errors are thrown for invalid state initialization logic.
4. State mutations are only allowed inside event handlers.
5. Test cases ensure all invalid scenarios are caught at compile time.

### Example:
```html
<script>
  state count = 5;
  state other = count + 1; // Error
</script>
<p>{{ count + 1 }}</p> <!-- Error -->
<p>{{ unknown }}</p> <!-- Error -->