from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from Options import Choice, DeathLink, OptionGroup, Range, StartInventoryPool, Toggle
from worlds.AutoWorld import PerGameCommonOptions

if TYPE_CHECKING:
    from . import ArchipelaCodeWorld


def create_options_groups() -> list[OptionGroup]:
    option_group_list: list[OptionGroup] = []
    for name, options in apcode_option_groups.items():
        option_group_list.append(OptionGroup(name=name, options=options))

    return option_group_list


def adjust_options(world: "ArchipelaCodeWorld"):
    pass


class EndGoal(Range):
    """The percentage of problems needed to be completed in order to "win" the game."""

    display_name = "End Goal"
    range_start = 1
    range_end = 100
    default = 60


class TotalProblemCount(Range):
    """How many total problems to include."""

    display_name = "Total Problems"
    range_start = 30
    range_end = 200
    default = 50


class LanguageChoice(Choice):
    """Which programming language you want to use."""

    display_name = "Language Choice"
    option_python = 0
    option_javascript = 1
    option_typescript = 2
    option_golang = 3
    default = 0


class DeathLinkOption(DeathLink):
    """When enabled, failing tests on LeetCode will send a death to other players in the multiworld."""

    display_name = "DeathLink"


class EnableTraps(Toggle):
    """When enabled, trap items may be received from the multiworld."""

    display_name = "Enable Traps"
    default = False


@dataclass
class APCodeOptions(PerGameCommonOptions):
    start_inventory_from_pool: StartInventoryPool
    EndGoal: EndGoal
    TotalProblemCount: TotalProblemCount
    LanguageChoice: LanguageChoice
    death_link: DeathLinkOption
    enable_traps: EnableTraps


apcode_option_groups: dict[str, list[Any]] = {}
