import Dashboard from './pages/Dashboard';
import Matters from './pages/Matters';
import Research from './pages/Research';
import MatterDetail from './pages/MatterDetail';
import ArgumentBuilder from './pages/ArgumentBuilder';
import DocumentGenerator from './pages/DocumentGenerator';
import Analytics from './pages/Analytics';
import JudgmentAnalyzer from './pages/JudgmentAnalyzer';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Matters": Matters,
    "Research": Research,
    "MatterDetail": MatterDetail,
    "ArgumentBuilder": ArgumentBuilder,
    "DocumentGenerator": DocumentGenerator,
    "Analytics": Analytics,
    "JudgmentAnalyzer": JudgmentAnalyzer,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};