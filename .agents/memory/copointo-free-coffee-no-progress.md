---
name: Redeemed free coffee gives no level progress
description: Why awardOrderProgress subtracts free-coffee-redeemed cups from the drink tally
---

# Redeemed free coffee must not raise level/milestone

A free coffee being **redeemed** is a reward being consumed, not a new paid drink.
At invoice print (`awardOrderProgress`, the single award path, called from POST print
in `cafe-dashboard.ts`), the credited tally is `paidDrinks = max(0, drinks - freeDrinks)`,
where `freeDrinks` counts `order.freeCoffeeRedemptions` entries whose matched order line
is still a qualifying drink (drink category allow-list + unit price > `LEVEL_MIN_DRINK_PRICE`
0.8 OMR). `paidDrinks` (not raw `drinks`) drives per-cafe `cafeProgress`, global
`level`/`totalOrders`, the push body, and `awardMilestoneCoffees`.

**Why:** otherwise a redeemed free cup counts toward the next free-coffee milestone,
letting one reward farm the next — user explicitly rejected this.

**How to apply:** any new code that credits drink/level progress from an order MUST
subtract free-coffee-redeemed qualifying cups the same way. `order.freeCoffeeRedemptions`
is `[{ code, level, itemName, itemPrice }]`, one record per redeemed cup; match back to
`order.items` by name to re-check qualification (item edits before print can change it).
