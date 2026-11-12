"""Function shapes the span reader has to agree with ast on."""

import functools


def plain(x):
    return x


async def fetch(url):
    return await get(url)


def one_line(): ...


def one_line_return(x): return (
    x + 1
)


@functools.cache
@register(
    "decorated",
)
def decorated(a, b=lambda c: c):
    return a


def multi_line_signature(
    first: int,
    second: dict[str, int] = {"a": 1},
) -> list[int]:
    return [first]


def generic[T](items: list[T]) -> T:
    return items[0]


class Service:
    """A class whose methods sit at depth 0."""

    def __init__(self):
        self.ready = True

    @property
    def name(self):
        return "service"

    class Inner:
        def method(self):
            def helper():
                return 1

            return helper()


def outer():
    def middle():
        def inner():
            return 1

        return inner

    class Local:
        def method(self):
            return 2

    return middle


def body_with_dedented_comment():
    x = 1
# a comment at column 0 inside the body

    return x
    # a trailing comment past the last statement


def with_match(command):
    match command:
        case "go":
            return 1
        case _:
            return 0


def with_try():
    try:
        work()
    except (ValueError, TypeError):
        pass
    finally:
        done()


def last_in_file():
    if True:
        if True:
            return 1
