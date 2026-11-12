"""Strings, brackets, and continuations that hide a dedent from the reader."""


def docstring_at_column_zero():
    """
def not_a_function():
    pass
"""
    return 1


def raw_and_bytes():
    pattern = r"\d+\\" + r'\'def x(): pass'
    data = b'\x00\'' + rb"""
def still_a_string(): pass"""
    return pattern, data


def formatted(user):
    message = f"{user['name']} has {len(user["items"])} items {{literal}}"
    nested = f"{f'{user}'}"
    spec = f"{user!r:>{10}}"
    return message, nested, spec


def triple_formatted(rows):
    return f"""
{rows}
def not_here(): pass
"""


def bracket_dedent():
    values = [
1,
    2,
        3,
]
    mapping = {
"a": (1,
2),
}
    return values, mapping


def continuation():
    total = 1 + \
2 + \
        3
    return total


def hash_inside_string():
    return "# not a comment", '#'


def comment_with_quote():
    # it's a comment, so this quote opens nothing
    return 1


def semicolons(): a = 1; b = 2; return a + b


def after_all():
    return '''single
quoted ''' + """mixed ' "quotes" """
