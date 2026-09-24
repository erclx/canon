<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class SmokeTest extends TestCase
{
    public function testSmoke(): void
    {
        $this->assertSame(2, 1 + 1);
    }
}
