/// Hero Forge — a Display V2 showcase built around dynamic object fields.
///
/// A `Hero`'s on-chain struct fields NEVER change after mint. Items (`Sword`,
/// `Shield`, `Armor`) are minted as their own objects and attached to the Hero as
/// **dynamic object fields**. The Hero's `Display<Hero>` template — set ONCE at
/// deploy — projects live over whatever items are currently attached, using the V2
/// dynamic-object-field load operator `=>`. Equip an item and the rendered Display
/// changes; the Hero object itself is untouched.
///
/// This is the capability the classic V1 Display could not express. The dapp targets
/// devnet over gRPC (the SDK 2.0 recommendation — JSON-RPC is deprecated); devnet's
/// fullnode resolves the `=>` load operators in the Display response.
#[allow(lint(self_transfer))]
module hero_forge::hero;

use std::string::String;
use sui::display_registry::{Self, DisplayRegistry};
use sui::dynamic_object_field as dof;
use sui::package::{Self, Publisher};

// === Errors ===

/// That equipment slot is already filled (one Sword/Shield/Armor per Hero).
const EAlreadyEquipped: u64 = 0;

/// Nothing is equipped in that slot.
const ENotEquipped: u64 = 1;

// === One-time witness ===

/// Consumed in `init` to claim the package `Publisher`.
public struct HERO has drop {}

// === Objects ===

/// The Hero. `base_attack` / `base_defense` are fixed at mint and never mutated.
/// Items live as dynamic object fields under `id`, not as struct fields here.
public struct Hero has key, store {
    id: UID,
    name: String,
    image_url: String,
    base_attack: u64,
    base_defense: u64,
}

/// Boosts attack only.
public struct Sword has key, store {
    id: UID,
    name: String,
    image_url: String,
    attack: u64,
    /// Pre-formatted one-line label the Hero Display projects (e.g. "[Iron Sword +6 ATK] ").
    summary: String,
}

/// Boosts defense only.
public struct Shield has key, store {
    id: UID,
    name: String,
    image_url: String,
    defense: u64,
    summary: String,
}

/// Boosts mostly defense, a little attack.
public struct Armor has key, store {
    id: UID,
    name: String,
    image_url: String,
    attack: u64,
    defense: u64,
    summary: String,
}

// === Dynamic-object-field keys ===
// These String values must match the string literals in the Display template
// (`{$self=>['sword']...}`), so the resolver finds the attached child.

fun sword_key(): String { b"sword".to_string() }
fun shield_key(): String { b"shield".to_string() }
fun armor_key(): String { b"armor".to_string() }

// === Init ===

/// Claim the Publisher on publish and hand it to the deployer, who then calls
/// `create_displays` (separate call — the DisplayRegistry is a shared object and
/// cannot be received inside `init`).
fun init(otw: HERO, ctx: &mut TxContext) {
    transfer::public_transfer(package::claim(otw, ctx), ctx.sender());
}

// === Minting ===

/// Construct a Hero with fixed base stats (composable; caller decides what to do with it).
public fun new_hero(name: String, image_url: String, base_attack: u64, base_defense: u64, ctx: &mut TxContext): Hero {
    Hero { id: object::new(ctx), name, image_url, base_attack, base_defense }
}

/// Mint a Hero with fixed base stats and transfer it to the caller.
public fun mint_hero(
    name: String,
    image_url: String,
    base_attack: u64,
    base_defense: u64,
    ctx: &mut TxContext,
) {
    transfer::public_transfer(new_hero(name, image_url, base_attack, base_defense, ctx), ctx.sender());
}

/// Construct a Sword object (composable; caller decides what to do with it).
public fun new_sword(name: String, image_url: String, attack: u64, summary: String, ctx: &mut TxContext): Sword {
    Sword { id: object::new(ctx), name, image_url, attack, summary }
}

public fun new_shield(name: String, image_url: String, defense: u64, summary: String, ctx: &mut TxContext): Shield {
    Shield { id: object::new(ctx), name, image_url, defense, summary }
}

public fun new_armor(name: String, image_url: String, attack: u64, defense: u64, summary: String, ctx: &mut TxContext): Armor {
    Armor { id: object::new(ctx), name, image_url, attack, defense, summary }
}

// === Equipping (dynamic object fields) ===
// One generic attach/detach pair; the per-item entry points below only fix T and the key.

fun equip<T: key + store>(hero: &mut Hero, key: String, item: T) {
    assert!(!dof::exists_(&hero.id, key), EAlreadyEquipped);
    dof::add(&mut hero.id, key, item);
}

public fun equip_sword(hero: &mut Hero, sword: Sword) { equip(hero, sword_key(), sword) }

public fun equip_shield(hero: &mut Hero, shield: Shield) { equip(hero, shield_key(), shield) }

public fun equip_armor(hero: &mut Hero, armor: Armor) { equip(hero, armor_key(), armor) }

/// Convenience: mint a Sword and attach it in one call.
public fun mint_and_equip_sword(hero: &mut Hero, name: String, image_url: String, attack: u64, summary: String, ctx: &mut TxContext) {
    equip_sword(hero, new_sword(name, image_url, attack, summary, ctx));
}

public fun mint_and_equip_shield(hero: &mut Hero, name: String, image_url: String, defense: u64, summary: String, ctx: &mut TxContext) {
    equip_shield(hero, new_shield(name, image_url, defense, summary, ctx));
}

public fun mint_and_equip_armor(hero: &mut Hero, name: String, image_url: String, attack: u64, defense: u64, summary: String, ctx: &mut TxContext) {
    equip_armor(hero, new_armor(name, image_url, attack, defense, summary, ctx));
}

// === Unequipping ===
// Detach and return the item to the caller so the demo can show stats revert live.

fun unequip<T: key + store>(hero: &mut Hero, key: String, ctx: &TxContext) {
    assert!(dof::exists_(&hero.id, key), ENotEquipped);
    let item: T = dof::remove(&mut hero.id, key);
    transfer::public_transfer(item, ctx.sender());
}

public fun unequip_sword(hero: &mut Hero, ctx: &TxContext) {
    unequip<Sword>(hero, sword_key(), ctx)
}

public fun unequip_shield(hero: &mut Hero, ctx: &TxContext) {
    unequip<Shield>(hero, shield_key(), ctx)
}

public fun unequip_armor(hero: &mut Hero, ctx: &TxContext) {
    unequip<Armor>(hero, armor_key(), ctx)
}

// === Display creation ===

/// One-time setup: create the shared `Display<Hero>` plus a `Display` for each item
/// type, set their templates, share them, and transfer the caps to the deployer.
///
/// The Hero `inventory` template is the headline: each item is loaded EXACTLY ONCE
/// via `=>` (2 loads each → 6 total, within the 8-load budget) and its `summary`
/// projected. With nothing equipped every load is null and the field renders empty.
///
/// Not unit-tested (test_scenario can't seed the DisplayRegistry singleton at 0xd);
/// exercised end-to-end by hero-scripts/publish-devnet.sh instead.
public fun create_displays(
    registry: &mut DisplayRegistry,
    publisher: &mut Publisher,
    ctx: &mut TxContext,
) {
    // --- Hero ---
    let (mut hero_display, hero_cap) = display_registry::new_with_publisher<Hero>(registry, publisher, ctx);
    hero_display.set(&hero_cap, b"name".to_string(), b"{name}".to_string());
    hero_display.set(&hero_cap, b"image_url".to_string(), b"{image_url}".to_string());
    // Immutable on-chain base stats.
    hero_display.set(&hero_cap, b"attack".to_string(), b"{base_attack}".to_string());
    hero_display.set(&hero_cap, b"defense".to_string(), b"{base_defense}".to_string());
    // Live projection over attached dynamic object fields — the V2 headline.
    hero_display.set(
        &hero_cap,
        b"inventory".to_string(),
        b"{$self=>['sword'].summary | ''}{$self=>['shield'].summary | ''}{$self=>['armor'].summary | ''}".to_string(),
    );
    display_registry::share(hero_display);
    transfer::public_transfer(hero_cap, ctx.sender());

    // --- Items: each type gets its own Display<T> (name + image_url + one stat field) ---
    create_item_display<Sword>(registry, publisher, b"attack", b"+{attack} ATK", ctx);
    create_item_display<Shield>(registry, publisher, b"defense", b"+{defense} DEF", ctx);
    create_item_display<Armor>(registry, publisher, b"defense", b"+{defense} DEF / +{attack} ATK", ctx);
}

/// Create a shared `Display<T>` for an item type: `name` + `image_url` + one stat field,
/// then share it and hand the cap to the deployer. Shared by all three item types.
fun create_item_display<T>(
    registry: &mut DisplayRegistry,
    publisher: &mut Publisher,
    stat_key: vector<u8>,
    stat_template: vector<u8>,
    ctx: &mut TxContext,
) {
    let (mut display, cap) = display_registry::new_with_publisher<T>(registry, publisher, ctx);
    display.set(&cap, b"name".to_string(), b"{name}".to_string());
    display.set(&cap, b"image_url".to_string(), b"{image_url}".to_string());
    display.set(&cap, stat_key.to_string(), stat_template.to_string());
    display_registry::share(display);
    transfer::public_transfer(cap, ctx.sender());
}

// === Tests ===

#[test_only]
use sui::test_scenario as ts;

#[test_only]
fun s(bytes: vector<u8>): String { bytes.to_string() }

#[test]
fun mint_equip_unequip_flow() {
    let user = @0xA11CE;
    let mut sc = ts::begin(user);

    // Mint a hero.
    mint_hero(s(b"Aragorn"), s(b"https://img/hero.png"), 10, 10, sc.ctx());
    sc.next_tx(user);

    let mut hero = sc.take_from_sender<Hero>();
    // Base stats are what we minted.
    assert!(hero.base_attack == 10);
    assert!(hero.base_defense == 10);
    // No slots filled yet.
    assert!(!dof::exists_(&hero.id, sword_key()));

    // Equip a sword.
    mint_and_equip_sword(&mut hero, s(b"Iron Sword"), s(b"https://img/sword.png"), 6, s(b"[Iron Sword +6 ATK] "), sc.ctx());
    assert!(dof::exists_(&hero.id, sword_key()));
    // Base stats unchanged by equipping — the whole point.
    assert!(hero.base_attack == 10);

    // Unequip returns the sword to the caller and clears the slot.
    unequip_sword(&mut hero, sc.ctx());
    assert!(!dof::exists_(&hero.id, sword_key()));

    sc.next_tx(user);
    // The sword is now a standalone owned object again.
    let sword = sc.take_from_sender<Sword>();
    assert!(sword.attack == 6);
    transfer::public_transfer(sword, user);

    transfer::public_transfer(hero, user);
    sc.end();
}

#[test]
fun equip_unequip_armor_flow() {
    let user = @0xA11CE;
    let mut sc = ts::begin(user);
    mint_hero(s(b"Aragorn"), s(b"https://img/hero.png"), 10, 10, sc.ctx());
    sc.next_tx(user);
    let mut hero = sc.take_from_sender<Hero>();

    // Armor is the only two-stat item — exercise its full equip/unequip path.
    mint_and_equip_armor(&mut hero, s(b"Plate Armor"), s(b"https://img/armor.png"), 2, 5, s(b"[Plate Armor +5 DEF +2 ATK] "), sc.ctx());
    assert!(dof::exists_(&hero.id, armor_key()));
    // Base stats untouched by equipping.
    assert!(hero.base_attack == 10);
    assert!(hero.base_defense == 10);

    unequip_armor(&mut hero, sc.ctx());
    assert!(!dof::exists_(&hero.id, armor_key()));

    sc.next_tx(user);
    let armor = sc.take_from_sender<Armor>();
    assert!(armor.attack == 2);
    assert!(armor.defense == 5);
    transfer::public_transfer(armor, user);

    transfer::public_transfer(hero, user);
    sc.end();
}

#[test, expected_failure(abort_code = EAlreadyEquipped)]
fun cannot_equip_two_swords() {
    let user = @0xA11CE;
    let mut sc = ts::begin(user);
    mint_hero(s(b"Aragorn"), s(b"https://img/hero.png"), 10, 10, sc.ctx());
    sc.next_tx(user);
    let mut hero = sc.take_from_sender<Hero>();

    mint_and_equip_sword(&mut hero, s(b"Iron Sword"), s(b"https://img/sword.png"), 6, s(b"[Iron Sword +6 ATK] "), sc.ctx());
    // Second sword into the same slot must abort.
    mint_and_equip_sword(&mut hero, s(b"Steel Sword"), s(b"https://img/sword.png"), 9, s(b"[Steel Sword +9 ATK] "), sc.ctx());

    transfer::public_transfer(hero, user);
    sc.end();
}
