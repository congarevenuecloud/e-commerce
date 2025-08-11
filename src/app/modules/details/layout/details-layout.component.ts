import { Component, ContentChildren, AfterContentInit, OnDestroy, OnChanges, SimpleChanges, QueryList, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { get, set, findIndex } from 'lodash';
import { AObject } from '@congarevenuecloud/core';
import { DetailSectionComponent } from '../detail-section/detail-section.component';
/**
 * Details Layout Component shows the details of the placed order or the requested quote.
 */
@Component({
  selector: 'app-detail',
  templateUrl: './details-layout.component.html',
  styleUrls: ['./details-layout.component.scss']
})
export class DetailsLayoutComponent implements AfterContentInit, OnDestroy, OnChanges {

  @ContentChildren(DetailSectionComponent, { descendants: true }) sections: QueryList<DetailSectionComponent>;

  filteredSections: DetailSectionComponent[] = [];
  private sectionsSubscription: Subscription;
  
  @ViewChild('primaryActions', { static: true }) primaryActions: any;
  @ViewChild('secondaryActions', { static: true }) secondaryActions: any;
  @ViewChild('headerNav', { static: true }) headerNav: ElementRef<any>;

  @Input() title: string;
  @Input() subtitle: string;
  @Input() context: AObject;
  @Input() route: string;
  @Input() hideLink: boolean = false;

  private activeTabIndex = 0;

  hidePrimaryActions: boolean = false;
  hideSecondaryActions: boolean = false;

  ngOnChanges(changes: SimpleChanges) {
    // If hideLink input property changes, update filtered sections
    if (changes['hideLink'] && this.sections) {
      this.updateFilteredSections();
    }
  }

  ngAfterContentInit() {
    this.updateFilteredSections();

    // Subscribe to changes in the sections QueryList
    this.sectionsSubscription = this.sections.changes.subscribe(() => {
      this.updateFilteredSections();
    });
    this.hidePrimaryActions = get(this, 'primaryActions.nativeElement.children.length', 0) <= 0;
    this.hideSecondaryActions = get(this, 'secondaryActions.nativeElement.children.length', 0) <= 0;
    
    // Set the first visible section as active
    const visibleSections = this.getVisibleSections();
    if (visibleSections.length > 0) {
      visibleSections[0].active = true;
    }
  }

  private updateFilteredSections() {
    // Show all sections in the filtered list
    this.filteredSections = this.sections.toArray();
  }

  getVisibleSections(): DetailSectionComponent[] {
    const visible = this.filteredSections.filter(section => !section.hideLink);
    return visible;
  }

  /**
   * HostListener Decorator a DOM event to listen for, and provides a handler method to run when that 
   * event occurs. Here attaches listener to window on scroll event.
   * In onScroll method assigns headerClass property with the class "'fixed-top' | 'fixed-top expand'" based on window 
   * pageYOffset and set the tab active.
   */
  @HostListener('window:scroll', ['$event'])
  onScroll(event) {
    if (this.headerClass != null && window.pageYOffset < 35) {
      this.headerClass = 'fixed-top  position-fixed expand';
      setTimeout(() => this.headerClass = null, 200);
    } else if (window.pageYOffset >= 35) {
      this.headerClass = 'fixed-top position-fixed';
    } else {
      this.headerClass = null;
    }

    this.setActiveTab();
  }
  headerClass: 'fixed-top position-fixed' | 'fixed-top  position-fixed expand' = null;

  /**
   * scrollTo method scrolls the page to the specified tab content.
   */
  scrollTo(tab: DetailSectionComponent) {
    // Find the index of the tab in the original sections array
    const allSections = this.sections.toArray();
    const tabIndex = allSections.findIndex(section => section.title === tab.title);
    
    // If it's the first tab (index 0), scroll to top
    if (tabIndex === 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      return;
    }
    
    // For other tabs, calculate the absolute position
    let elementTop = tab.element.nativeElement.offsetTop;
    let element = tab.element.nativeElement;
    
    // Get the absolute position by traversing up the offset parent chain
    while (element.offsetParent) {
      element = element.offsetParent;
      elementTop += element.offsetTop;
    }
    
    const headerHeight = this.headerNav.nativeElement.offsetHeight;
    const scrollPosition = Math.max(0, elementTop - headerHeight - 10);
    
    window.scrollTo({ top: scrollPosition, left: 0, behavior: 'smooth' });
  }

  setActiveTab() {
    let index = 0;
    const visibleSections = this.getVisibleSections();
    if (visibleSections && visibleSections.length > 0) {
      const amounts = visibleSections.map(s => this.getElementPercentage(s.element.nativeElement));
      index = amounts.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);

      if (index !== this.activeTabIndex) {
        this.filteredSections.forEach(t => t.active = false);
        visibleSections[index].active = true;
        this.activeTabIndex = index;
      }
    }
  }

  trackByComponent(index, tab: DetailSectionComponent) {
    return tab.title;
  }

  getElementPercentage(el) {
    let top = el.offsetTop;
    const height = el.offsetHeight;

    while (el.offsetParent) {
      el = el.offsetParent;
      top += el.offsetTop;
    }


    const startA = top;
    const endA = top + height;

    const startB = window.pageYOffset + this.headerNav.nativeElement.offsetHeight;
    const endB = window.pageYOffset + window.innerHeight;

    if (startB > endA || startA > endB)
      return 0;
    else {
      const startO = (startA > startB) ? startA : startB;
      const endO = (endA < endB) ? endA : endB;
      return (endO - startO) / height;
    }
  }

  ngOnDestroy() {
    if (this.sectionsSubscription) {
      this.sectionsSubscription.unsubscribe();
    }
  }
}
