import { DetailAction, DetailActionArea, DetailActionSection, DetailActionUserType } from '@congarevenuecloud/ecommerce';

// Every user type; equivalent to leaving UserType empty.
const ALL_USERS = [DetailActionUserType.LoggedIn, DetailActionUserType.Guest];

// Only authenticated users.
const LOGGED_IN_ONLY = [DetailActionUserType.LoggedIn];

// Only guest (unauthenticated) users.
const GUEST_ONLY = [DetailActionUserType.Guest];

// Built-in action configuration for every detail page section, used when the storefront
// displayActions API returns no override. ActionArea places each action in the header (Main) or the
// kebab menu; Sequence orders actions within an area. Authoring actions (Generate/Present) lead the
// header while the quote is being built, then move into the kebab once it is Presented so the buyer
// Accept/Reject actions take the header — matching the built-in page layout.
export const DEFAULT_DETAIL_ACTIONS: Array<DetailAction> = [
  // ---------------------------------------------------------------------------------------------
  // Quote detail - buyer actions once the quote is presented
  // ---------------------------------------------------------------------------------------------
  {
    Name: 'Reject',
    Section: DetailActionSection.Quote,
    Sequence: 1,
    IsEnabled: true,
    ActionName: 'Reject',
    ActionArea: DetailActionArea.Main,
    AlwaysDisplay: false,
    ActionLabelName: 'COMMON.REJECT',
    IsPrimaryAction: false,
    Stage: ['Presented'],
    UserType: ALL_USERS
  },
  {
    Name: 'AcceptQuote',
    Section: DetailActionSection.Quote,
    Sequence: 2,
    IsEnabled: true,
    ActionName: 'AcceptQuote',
    ActionArea: DetailActionArea.Main,
    AlwaysDisplay: false,
    ActionLabelName: 'COMMON.ACCEPT_QUOTE',
    IsPrimaryAction: true,
    Stage: ['Presented'],
    UserType: ALL_USERS
  },

  // ---------------------------------------------------------------------------------------------
  // Quote detail - seller authoring actions, header while drafting / generated
  // ---------------------------------------------------------------------------------------------
  {
    Name: 'Generate',
    Section: DetailActionSection.Quote,
    Sequence: 3,
    IsEnabled: true,
    ActionName: 'Generate',
    ActionArea: DetailActionArea.Main,
    AlwaysDisplay: false,
    ActionLabelName: 'DETAILS.GENERATE_QUOTE',
    IsPrimaryAction: false,
    Stage: ['Draft', 'Generated'],
    UserType: LOGGED_IN_ONLY
  },
  {
    Name: 'Present',
    Section: DetailActionSection.Quote,
    Sequence: 4,
    IsEnabled: true,
    ActionName: 'Present',
    ActionArea: DetailActionArea.Main,
    AlwaysDisplay: false,
    ActionLabelName: 'DETAILS.PRESENT_QUOTE',
    IsPrimaryAction: true,
    Stage: ['Generated'],
    UserType: LOGGED_IN_ONLY
  },

  // ---------------------------------------------------------------------------------------------
  // Quote detail - authoring actions and request changes move to the kebab once presented
  // ---------------------------------------------------------------------------------------------
  {
    Name: 'GeneratePresented',
    Section: DetailActionSection.Quote,
    Sequence: 5,
    IsEnabled: true,
    ActionName: 'Generate',
    ActionArea: DetailActionArea.Kebab,
    AlwaysDisplay: false,
    ActionLabelName: 'DETAILS.GENERATE_QUOTE',
    IsPrimaryAction: false,
    Stage: ['Presented'],
    UserType: LOGGED_IN_ONLY
  },
  {
    Name: 'PresentPresented',
    Section: DetailActionSection.Quote,
    Sequence: 6,
    IsEnabled: true,
    ActionName: 'Present',
    ActionArea: DetailActionArea.Kebab,
    AlwaysDisplay: false,
    ActionLabelName: 'DETAILS.PRESENT_QUOTE',
    IsPrimaryAction: false,
    Stage: ['Presented'],
    UserType: LOGGED_IN_ONLY
  },
  {
    Name: 'RequestChanges',
    Section: DetailActionSection.Quote,
    Sequence: 7,
    IsEnabled: true,
    ActionName: 'RequestChanges',
    ActionArea: DetailActionArea.Kebab,
    AlwaysDisplay: false,
    ActionLabelName: 'COMMENTS.REQUEST_CHANGES',
    IsPrimaryAction: false,
    Stage: ['Presented'],
    UserType: ALL_USERS
  },
  // Non-DSR guests get Request Changes as a header button instead of the kebab (built-in parity).
  {
    Name: 'RequestChangesGuest',
    Section: DetailActionSection.Quote,
    Sequence: 8,
    IsEnabled: true,
    ActionName: 'RequestChanges',
    ActionArea: DetailActionArea.Main,
    AlwaysDisplay: false,
    ActionLabelName: 'COMMENTS.REQUEST_CHANGES',
    IsPrimaryAction: true,
    Stage: ['Presented'],
    UserType: GUEST_ONLY
  },

  // ---------------------------------------------------------------------------------------------
  // Cart detail
  // ---------------------------------------------------------------------------------------------
  {
    Name: 'RequestQuote',
    Section: DetailActionSection.Cart,
    Sequence: 1,
    IsEnabled: true,
    ActionName: 'RequestQuote',
    ActionArea: DetailActionArea.Main,
    AlwaysDisplay: true,
    ActionLabelName: 'COMMON.REQUEST_QUOTE',
    IsPrimaryAction: false,
    Stage: [],
    UserType: ALL_USERS
  },
  {
    Name: 'BeginCheckout',
    Section: DetailActionSection.Cart,
    Sequence: 2,
    IsEnabled: true,
    ActionName: 'BeginCheckout',
    ActionArea: DetailActionArea.Main,
    AlwaysDisplay: true,
    ActionLabelName: 'COMMON.BEGIN_CHECKOUT',
    IsPrimaryAction: true,
    Stage: [],
    UserType: ALL_USERS
  }
];
